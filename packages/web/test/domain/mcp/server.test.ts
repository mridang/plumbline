import {
  CallToolResultSchema,
  GetPromptResultSchema,
  ListPromptsResultSchema,
  ListResourceTemplatesResultSchema,
  ListResourcesResultSchema,
  ListToolsResultSchema,
  ReadResourceResultSchema,
} from '@modelcontextprotocol/core';
import { describe, expect, it, jest } from '@jest/globals';

import type { User } from '@/domain/db/users';
import {
  CACHE_HINTS,
  handleMcpMessage,
  readCache,
  isAdvertisedTool,
  type JsonRpcResponse,
  type ToolRunner,
} from '@/domain/mcp/server';
import { callTool, callToolOrExplain } from '@/domain/mcp/tool-calls';
import { InvalidToolArguments, UnknownTool } from '@/lib/mcp';
import {
  CAPABILITIES,
  INSTRUCTIONS,
  SERVER_INFO,
} from '@/domain/mcp/server-info';
import { textResult } from '@/domain/mcp/tool-results';
import { APP_RESOURCES } from '@/domain/mcp/ui-resources';
import { TOOLS } from '@/domain/mcp/tool-definitions';
import { SCOPE_READ, SCOPE_WRITE, scopeForTool } from '@/lib/oauth';
import { addDomain } from '@/domain/db/domains';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

/** The address of a view the server serves. */
const FIRST_VIEW = APP_RESOURCES.at(0)?.uri ?? '';

/** The user every test acts as. */
const someone = { id: 1 } as User;

describe('MCP tool scopes', () => {
  it('only lets read-only tools through with the read scope', () => {
    const readTools = TOOLS.filter(
      (t) => scopeForTool(t.name) === SCOPE_READ,
    ).map((t) => t.name);
    expect(readTools.toSorted()).toEqual([
      'get_domain',
      'get_report',
      'list_checks',
      'list_domains',
      'list_reports',
      'list_repositories',
      'scan_domain',
    ]);
  });

  it('treats every other tool as a write, so new tools are protected by default', () => {
    const writeTools = TOOLS.filter(
      (t) => scopeForTool(t.name) === SCOPE_WRITE,
    ).map((t) => t.name);
    expect(writeTools.toSorted()).toEqual([
      'configure_checks',
      'remove_domain',
    ]);
    expect(scopeForTool('a_tool_added_next_year')).toBe(SCOPE_WRITE);
  });

  it('marks exactly the read-scoped tools as read-only', () => {
    for (const tool of TOOLS) {
      expect(tool.annotations.readOnlyHint).toBe(
        scopeForTool(tool.name) === SCOPE_READ,
      );
    }
  });
});

describe('handleMcpMessage notifications', () => {
  it('gives no reply to any notification', async () => {
    for (const method of [
      'notifications/initialized',
      'notifications/cancelled',
    ]) {
      expect(
        await handleMcpMessage(someone, { jsonrpc: '2.0', method }),
      ).toBeNull();
    }
  });
});

describe('handleMcpMessage routing', () => {
  const MODERN_META = {
    _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
  };
  const send = (message: Record<string, unknown>) =>
    handleMcpMessage(someone, { jsonrpc: '2.0', id: 1, ...message });

  it('answers the handshake with a version both sides speak', async () => {
    const reply = await send({
      method: 'initialize',
      params: { protocolVersion: '2025-03-26' },
    });
    expect(reply).toMatchObject({
      id: 1,
      result: {
        protocolVersion: '2025-03-26',
        serverInfo: { name: 'plumbline' },
      },
    });
  });

  it('describes itself to a client that does not handshake', async () => {
    const reply = await send({ method: 'server/discover' });
    expect(reply).toMatchObject({
      result: { resultType: 'complete', cacheScope: 'public' },
    });
  });

  it('answers ping with an empty result', async () => {
    expect(await send({ method: 'ping' })).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    });
  });

  it('marks results complete only for the newest revision', async () => {
    expect(
      await send({ method: 'tools/list', params: MODERN_META }),
    ).toMatchObject({
      result: { resultType: 'complete' },
    });
    expect(await send({ method: 'ping' })).not.toHaveProperty(
      'result.resultType',
    );
  });

  it.each(['initialize', 'ping'])(
    'answers %s for the older revisions, and says it was removed to the newest',
    async (method) => {
      expect(await send({ method })).toMatchObject({ result: {} });
      expect(await send({ method, params: MODERN_META })).toMatchObject({
        error: { code: -32_601 },
      });
    },
  );

  it('lists the tools', async () => {
    const reply = await send({ method: 'tools/list' });
    expect(reply).toMatchObject({ result: { tools: TOOLS } });
  });

  it('lists the views and serves their HTML', async () => {
    const listed = (await send({ method: 'resources/list' })) as {
      result: { resources: { uri: string; mimeType: string }[] };
    };
    expect(listed.result.resources.map((r) => r.uri)).toEqual(
      APP_RESOURCES.filter((r) => !r.legacy).map((r) => r.uri),
    );
    const [first] = APP_RESOURCES;
    const read = await send({
      method: 'resources/read',
      params: { uri: first?.uri },
    });
    expect(read).toMatchObject({
      result: {
        contents: [
          {
            uri: first?.uri,
            mimeType: 'text/html;profile=mcp-app',
          },
        ],
      },
    });
  });

  it('serves an older hashed view address under the address asked for', async () => {
    const stale = 'ui://plumbline/report-000000000000.html';
    expect(
      await send({ method: 'resources/read', params: { uri: stale } }),
    ).toMatchObject({ result: { contents: [{ uri: stale }] } });
  });

  it('lists no resource templates', async () => {
    expect(await send({ method: 'resources/templates/list' })).toMatchObject({
      result: { resourceTemplates: [] },
    });
  });

  it('lists the prompts and returns one with its arguments filled in', async () => {
    const listed = (await send({ method: 'prompts/list' })) as {
      result: { prompts: { name: string }[] };
    };
    expect(listed.result.prompts.map((p) => p.name)).toEqual([
      'audit-domain',
      'my-domains',
      'choose-checks',
    ]);
    expect(
      await send({
        method: 'prompts/get',
        params: {
          name: 'audit-domain',
          arguments: { domain: 'example.com' },
        },
      }),
    ).toMatchObject({
      result: { messages: [{ role: 'user', content: { type: 'text' } }] },
    });
  });

  it('refuses an unknown prompt and a missing required argument as bad parameters', async () => {
    expect(
      await send({ method: 'prompts/get', params: { name: 'nope' } }),
    ).toMatchObject({ error: { code: -32_602 } });
    expect(
      await send({
        method: 'prompts/get',
        params: { name: 'audit-domain' },
      }),
    ).toMatchObject({ error: { code: -32_602 } });
  });

  it('refuses an unknown view', async () => {
    expect(
      await send({ method: 'resources/read', params: { uri: 'ui://nope' } }),
    ).toMatchObject({ error: { code: -32_602 } });
  });

  it('refuses an unknown method', async () => {
    expect(await send({ method: 'wibble' })).toMatchObject({
      error: { code: -32_601, message: 'Method not found' },
    });
  });

  it('keeps the reason for a server fault to itself', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const reply = await handleMcpMessage(
      someone,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_domains', arguments: {} },
      },
      async () => {
        throw new Error('the database said something private');
      },
    );
    // The client learns nothing of why.
    expect(reply).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32_603, message: 'Something went wrong on the server.' },
    });
    spy.mockRestore();
  });
});

describe('the tool catalogue', () => {
  it('has a unique name for every tool', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('is fully served: no advertised tool is unknown to the dispatcher', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    // Empty arguments may well be refused as invalid; what must never happen is
    // that the dispatcher does not know the tool.
    const isUnknown = async (name: string): Promise<boolean> => {
      try {
        await callTool(someone, { name, arguments: {} }, () => db);
        return false;
      } catch (error) {
        return error instanceof UnknownTool;
      }
    };
    const unknown = (
      await Promise.all(
        TOOLS.map(async (t) => ((await isUnknown(t.name)) ? t.name : '')),
      )
    ).filter(Boolean);
    expect(unknown).toEqual([]);
  });
});

describe('handleMcpMessage — the newest revision', () => {
  const MODERN = {
    _meta: {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientCapabilities': {},
    },
  };
  const SERVER_INFO_KEY = 'io.modelcontextprotocol/serverInfo';
  const send = (
    message: Record<string, unknown>,
    runTool?: ToolRunner,
  ): Promise<JsonRpcResponse | null> =>
    handleMcpMessage(someone, { jsonrpc: '2.0', id: 1, ...message }, runTool);
  const resultOf = async (
    message: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const reply = await send(message);
    if (!reply || !('result' in reply)) {
      throw new Error(`expected a result, got ${JSON.stringify(reply)}`);
    }
    return reply.result as Record<string, unknown>;
  };

  it.each([
    ['tools/list', undefined, CACHE_HINTS.list],
    ['resources/list', undefined, CACHE_HINTS.list],
    ['resources/read', { uri: FIRST_VIEW }, CACHE_HINTS.immutable],
    ['server/discover', undefined, CACHE_HINTS.discover],
  ])(
    'tells the client how long it may keep %s',
    async (method, params, hint) => {
      const result = await resultOf({
        method,
        params: { ...params, ...MODERN },
      });
      expect(result['ttlMs']).toBe(hint.ttlMs);
      expect(result['cacheScope']).toBe(hint.cacheScope);
      expect(result['resultType']).toBe('complete');
    },
  );

  it('gives every cache hint a non-negative lifetime and a scope the spec knows', () => {
    for (const hint of Object.values(CACHE_HINTS)) {
      expect(Number.isInteger(hint.ttlMs)).toBe(true);
      expect(hint.ttlMs).toBeGreaterThanOrEqual(0);
      expect(['public', 'private']).toContain(hint.cacheScope);
    }
  });

  it('keeps the large view cached longer than the lists, and shares them all', () => {
    expect(CACHE_HINTS.read.ttlMs).toBeGreaterThan(CACHE_HINTS.list.ttlMs);
    expect(CACHE_HINTS.immutable.ttlMs).toBeGreaterThan(CACHE_HINTS.read.ttlMs);
    for (const hint of Object.values(CACHE_HINTS)) {
      expect(hint.cacheScope).toBe('public');
    }
  });

  it('caches a view for everyone, and puts the cache hints on the lists the newest revision adds', async () => {
    for (const method of ['prompts/list', 'resources/templates/list']) {
      expect(await resultOf({ method, params: MODERN })).toMatchObject(
        CACHE_HINTS.list,
      );
    }
    expect(
      await resultOf({
        method: 'resources/read',
        params: { uri: FIRST_VIEW, ...MODERN },
      }),
    ).toMatchObject(CACHE_HINTS.immutable);
  });

  it('keeps a view for a day at its hashed address, and for less at an address whose content moves', () => {
    const current = APP_RESOURCES.filter((r) => !r.legacy);
    expect(current.length).toBeGreaterThan(0);
    for (const view of current) {
      expect(readCache({ contents: [{ uri: view.uri, text: 'x' }] })).toBe(
        CACHE_HINTS.immutable,
      );
    }
    expect(
      readCache({
        contents: [{ uri: 'ui://plumbline/report-000000000000.html' }],
      }),
    ).toBe(CACHE_HINTS.read);
  });

  it('keeps a read that is not of a view for the shorter time', () => {
    expect(readCache({})).toBe(CACHE_HINTS.read);
    expect(readCache({ contents: [] })).toBe(CACHE_HINTS.read);
    expect(readCache({ contents: [{ uri: 5 }] })).toBe(CACHE_HINTS.read);
  });

  it('puts no cache hints on a prompt', async () => {
    const result = await resultOf({
      method: 'prompts/get',
      params: { name: 'my-domains', ...MODERN },
    });
    expect(result).not.toHaveProperty('ttlMs');
  });

  it('puts no cache hints on results that are not cacheable', async () => {
    for (const message of [
      { method: 'ping' },
      {
        method: 'tools/call',
        params: { name: 'list_domains', arguments: {}, ...MODERN },
      },
    ]) {
      const reply = await send(message, async () => textResult('ok'));
      const result = (reply as { result: Record<string, unknown> }).result;
      expect(result).not.toHaveProperty('ttlMs');
      expect(result).not.toHaveProperty('cacheScope');
    }
  });

  it('puts no cache hints on an error', async () => {
    const reply = await send({
      method: 'resources/read',
      params: { uri: 'ui://nope', ...MODERN },
    });
    expect(reply).not.toHaveProperty('result');
    expect(JSON.stringify(reply)).not.toContain('ttlMs');
  });

  it('names the server in the _meta of every result', async () => {
    for (const message of [
      { method: 'prompts/list', params: MODERN },
      { method: 'tools/list', params: MODERN },
      { method: 'resources/list', params: MODERN },
      { method: 'server/discover', params: MODERN },
    ]) {
      const result = await resultOf(message);
      expect(result['_meta']).toMatchObject({ [SERVER_INFO_KEY]: SERVER_INFO });
    }
  });

  it('adds the server to a result’s own _meta instead of replacing it', async () => {
    const withMeta: ToolRunner = async () => ({
      ...textResult('ok'),
      _meta: { 'openai/outputTemplate': 'ui://x' },
    });
    const reply = await send(
      {
        method: 'tools/call',
        params: { name: 'list_domains', ...MODERN },
      },
      withMeta,
    );
    expect((reply as { result: { _meta: unknown } }).result._meta).toEqual({
      'openai/outputTemplate': 'ui://x',
      [SERVER_INFO_KEY]: SERVER_INFO,
    });
  });

  it('answers discovery the same with or without per-request metadata', async () => {
    const bare = await resultOf({ method: 'server/discover' });
    const full = await resultOf({ method: 'server/discover', params: MODERN });
    expect(bare).toEqual(full);
    expect(full).toMatchObject({
      supportedVersions: expect.arrayContaining(['2026-07-28', '2025-11-25']),
      capabilities: CAPABILITIES,
      instructions: INSTRUCTIONS,
    });
  });

  it('leaves a result for an older client exactly as the method made it', async () => {
    for (const method of ['tools/list', 'resources/list']) {
      const result = await resultOf({ method });
      expect(Object.keys(result)).toHaveLength(1);
    }
    const read = await resultOf({
      method: 'resources/read',
      params: { uri: FIRST_VIEW },
    });
    expect(Object.keys(read)).toEqual(['contents']);
  });

  it('does not treat an older version named in _meta as the newest era', async () => {
    const result = await resultOf({
      method: 'tools/list',
      params: {
        _meta: { 'io.modelcontextprotocol/protocolVersion': '2025-11-25' },
      },
    });
    expect(result).not.toHaveProperty('ttlMs');
    expect(result).not.toHaveProperty('resultType');
  });
});

describe('handleMcpMessage — what the server says about itself', () => {
  const result = async (message: Record<string, unknown>) =>
    (
      (await handleMcpMessage(someone, {
        jsonrpc: '2.0',
        id: 1,
        ...message,
      })) as { result: Record<string, unknown> }
    ).result;

  it('answers the older handshake with the full identity, the capabilities and the instructions', async () => {
    expect(
      await result({
        method: 'initialize',
        params: { protocolVersion: '2025-11-25' },
      }),
    ).toEqual({
      protocolVersion: '2025-11-25',
      capabilities: CAPABILITIES,
      serverInfo: SERVER_INFO,
      instructions: INSTRUCTIONS,
    });
  });

  it('declares the MCP Apps extension in the handshake and in discovery, and no more than it does', async () => {
    const handshake = await result({ method: 'initialize' });
    const discovery = await result({ method: 'server/discover' });
    for (const reply of [handshake, discovery]) {
      expect(reply['capabilities']).toEqual({
        tools: {},
        resources: {},
        prompts: {},
        extensions: { 'io.modelcontextprotocol/ui': {} },
      });
    }
  });
});

describe('handleMcpMessage — refusals', () => {
  const neverRun: ToolRunner = async () => {
    throw new Error('the tool must not run');
  };
  const send = (
    message: Record<string, unknown>,
    runTool: ToolRunner = neverRun,
  ) =>
    handleMcpMessage(
      someone,
      { jsonrpc: '2.0', id: 'q1', ...message },
      runTool,
    );

  it('echoes the request id on every error', async () => {
    for (const message of [
      { method: 'nope' },
      { method: 'resources/read', params: { uri: 'ui://nope' } },
      { method: 'tools/call', params: { name: 'nope' } },
    ]) {
      expect(await send(message)).toMatchObject({ id: 'q1' });
    }
  });

  it('answers a tool that is not advertised with -32602 and the tool names, without running anything', async () => {
    const reply = await send({
      method: 'tools/call',
      params: { name: 'wibble', arguments: {} },
    });
    expect(reply).toMatchObject({ error: { code: -32_602 } });
    const message = (reply as { error: { message: string } }).error.message;
    expect(message).toContain('Unknown tool: wibble');
    expect(message).toContain('list_domains');
  });

  it('answers a missing or non-text tool name the same way', async () => {
    for (const params of [{}, { name: 7 }, { name: null }, undefined]) {
      expect(await send({ method: 'tools/call', params })).toMatchObject({
        error: { code: -32_602 },
      });
    }
  });

  it('answers arguments that are not an object with -32602, before running anything', async () => {
    for (const args of ['x', 5, [], null]) {
      const reply = await send({
        method: 'tools/call',
        params: { name: 'list_domains', arguments: args },
      });
      expect(reply).toMatchObject({ error: { code: -32_602 } });
    }
  });

  it('runs a tool that is advertised, whatever its arguments are', async () => {
    const ran: unknown[] = [];
    const reply = await send(
      {
        method: 'tools/call',
        params: { name: 'list_domains', arguments: { limit: 3 } },
      },
      async (_user, params) => {
        ran.push(params);
        return textResult('done');
      },
    );
    expect(reply).toMatchObject({ result: { content: [{ text: 'done' }] } });
    expect(ran).toEqual([{ name: 'list_domains', arguments: { limit: 3 } }]);
  });

  it('maps an unknown tool reported by the tool code to -32602', async () => {
    const reply = await send(
      { method: 'tools/call', params: { name: 'list_domains' } },
      async () => {
        throw new UnknownTool('ghost');
      },
    );
    expect(reply).toMatchObject({
      id: 'q1',
      error: { code: -32_602, message: expect.stringContaining('ghost') },
    });
  });

  it('maps invalid arguments reported by the tool code to -32602, with what to fix', async () => {
    const reply = await send(
      { method: 'tools/call', params: { name: 'get_domain' } },
      async () => {
        throw new InvalidToolArguments([
          'Missing "name".',
          '"limit" must be a number.',
        ]);
      },
    );
    expect(reply).toEqual({
      jsonrpc: '2.0',
      id: 'q1',
      error: {
        code: -32_602,
        message:
          'Invalid arguments for tool get_domain: Missing "name". "limit" must be a number.',
        data: {
          tool: 'get_domain',
          problems: ['Missing "name".', '"limit" must be a number.'],
        },
      },
    });
  });

  it('answers arguments that do not fit the tool as an error result the model can read, not as a protocol error', async () => {
    const reply = await handleMcpMessage(someone, {
      jsonrpc: '2.0',
      id: 'q1',
      method: 'tools/call',
      params: { name: 'get_domain', arguments: { limit: 5 } },
    });
    expect(reply).not.toHaveProperty('error');
    expect(reply).toMatchObject({
      id: 'q1',
      result: {
        isError: true,
        content: [
          {
            type: 'text',
            text: expect.stringMatching(
              /Invalid arguments for get_domain: .*`domain` is required.*`limit` is not an argument/,
            ),
          },
        ],
      },
    });
  });

  it('marks that error result complete for the newest revision, and still echoes the id', async () => {
    const reply = await handleMcpMessage(someone, {
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: { name: 'get_domain', arguments: {} },
    });
    expect(reply).toMatchObject({ id: 9, result: { isError: true } });
    const modern = await handleMcpMessage(someone, {
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: {
        name: 'get_domain',
        arguments: {},
        _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
      },
    });
    expect(modern).toMatchObject({
      id: 9,
      result: { isError: true, resultType: 'complete' },
    });
  });

  it('repeats only the start of an absurdly long tool name', async () => {
    const reply = await send({
      method: 'tools/call',
      params: { name: 'x'.repeat(100_000) },
    });
    const message = (reply as { error: { message: string } }).error.message;
    expect(message.length).toBeLessThan(500);
  });

  it('answers any other fault with -32603 and no detail', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const reply = await send(
      { method: 'tools/call', params: { name: 'list_domains' } },
      async () => {
        throw new Error('D1 said: secret');
      },
    );
    expect(reply).toEqual({
      jsonrpc: '2.0',
      id: 'q1',
      error: { code: -32_603, message: 'Something went wrong on the server.' },
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('tells a view that is not there from a request with no address, and says which', async () => {
    expect(
      await send({ method: 'resources/read', params: { uri: 'ui://nope' } }),
    ).toEqual({
      jsonrpc: '2.0',
      id: 'q1',
      error: {
        code: -32_602,
        message: 'Resource not found',
        data: { uri: 'ui://nope' },
      },
    });
    for (const params of [{}, { uri: 5 }, { uri: null }, undefined]) {
      expect(await send({ method: 'resources/read', params })).toMatchObject({
        error: { code: -32_602, message: expect.stringContaining('`uri`') },
      });
    }
  });

  it('does not take the names of things every object has for methods', async () => {
    for (const method of [
      'constructor',
      'toString',
      '__proto__',
      'hasOwnProperty',
    ]) {
      expect(await send({ method })).toMatchObject({
        error: { code: -32_601 },
      });
    }
  });
});

describe('lists with only one page', () => {
  const list = (
    params: Record<string, unknown> | undefined,
    method = 'resources/list',
  ) => handleMcpMessage(someone, { jsonrpc: '2.0', id: 1, method, params });

  it.each([
    'tools/list',
    'prompts/list',
    'resources/list',
    'resources/templates/list',
  ])(
    'refuses a cursor on %s, which has one page and issues no cursors',
    async (method) => {
      for (const cursor of ['abc', 5, {}]) {
        expect(await list({ cursor }, method)).toMatchObject({
          error: { code: -32_602, message: 'Invalid cursor' },
        });
      }
    },
  );

  it.each([
    'tools/list',
    'prompts/list',
    'resources/list',
    'resources/templates/list',
  ])(
    'treats an absent, null or empty cursor on %s as the start',
    async (method) => {
      for (const params of [undefined, {}, { cursor: null }, { cursor: '' }]) {
        expect(await list(params, method)).toHaveProperty('result');
      }
    },
  );
});

describe('every reply parses with the SDK’s own schema for its method', () => {
  const MODERN = {
    _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
  };
  const resultOf = async (
    method: string,
    params: Record<string, unknown> | undefined,
  ): Promise<unknown> => {
    const reply = await handleMcpMessage(someone, {
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    });
    if (!reply || !('result' in reply)) {
      throw new Error(`expected a result, got ${JSON.stringify(reply)}`);
    }
    return reply.result;
  };
  const CASES = [
    ['tools/list', undefined, ListToolsResultSchema],
    ['resources/list', undefined, ListResourcesResultSchema],
    ['resources/templates/list', undefined, ListResourceTemplatesResultSchema],
    ['prompts/list', undefined, ListPromptsResultSchema],
    ['prompts/get', { name: 'my-domains' }, GetPromptResultSchema],
    ['resources/read', { uri: FIRST_VIEW }, ReadResourceResultSchema],
  ] as const;

  it.each(CASES)(
    '%s, to an older and to the newest client',
    async (method, params, schema) => {
      for (const extra of [{}, MODERN]) {
        const result = await resultOf(method, { ...params, ...extra });
        const parsed = schema.safeParse(result);
        expect({
          method,
          problems: parsed.success ? [] : parsed.error.issues,
        }).toEqual({ method, problems: [] });
      }
    },
  );

  it.each(TOOLS.map((tool) => [tool.name] as const))(
    'a call of %s, with a domain, with no arguments or with one it does not take',
    async (name) => {
      const { db } = sqliteDatabase(...APP_MIGRATIONS);
      await addDomain(db, someone.id, 'example.com');
      const run = (args: Record<string, unknown>) =>
        callToolOrExplain(someone, { name, arguments: args }, () => db);
      const results = await Promise.all([
        run({ domain: 'example.com' }),
        run({}),
        run({ surely_not_an_argument: 1 }),
      ]);
      for (const result of results) {
        const parsed = CallToolResultSchema.safeParse(result);
        expect({
          name,
          problems: parsed.success ? [] : parsed.error.issues,
        }).toEqual({ name, problems: [] });
      }
    },
  );
});

describe('isAdvertisedTool', () => {
  it('is true for the tools in the catalogue and nothing else', () => {
    for (const tool of TOOLS) {
      expect(isAdvertisedTool(tool.name)).toBe(true);
    }
    for (const other of ['nope', '', 'LIST_DOMAINS', 5, null, undefined]) {
      expect(isAdvertisedTool(other)).toBe(false);
    }
  });
});
