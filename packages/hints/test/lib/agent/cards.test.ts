import { describe, expect, it } from '@jest/globals';
import {
  MCP_CARD_TYPE,
  SKILLS_SCHEMA,
  checkA2aAgentCard,
  checkMcpServerCard,
  checkSkills,
  skillProblems,
} from '../../../src/lib/agent/cards.js';
import { fakeEnv, without } from './fake-env.js';

const mcpCard = {
  serverInfo: { name: 'srv', version: '1.0.0' },
  transport: { type: 'streamable-http', endpoint: '/mcp' },
};

describe('checkMcpServerCard', () => {
  it('passes with a SEP-1649 style card', async () => {
    const env = fakeEnv({ '/.well-known/mcp/server-card.json': mcpCard });
    const result = await checkMcpServerCard(env);
    expect(result.passed).toBe(true);
  });
  it('passes with a SEP-2127 style card (top-level identity, remotes)', async () => {
    const env = fakeEnv({
      '/.well-known/mcp/server-card.json': {
        name: 'com.example/weather',
        version: '1.0.0',
        remotes: [{ url: 'https://example.com/mcp' }],
      },
    });
    const result = await checkMcpServerCard(env);
    expect(result.passed).toBe(true);
  });
  it('accepts a card listed in a collection', async () => {
    const env = fakeEnv({
      '/.well-known/mcp.json': {
        servers: [
          { name: 'a', version: '1', remotes: [{ url: 'https://e.com/mcp' }] },
        ],
      },
    });
    const result = await checkMcpServerCard(env);
    expect(result.passed).toBe(true);
  });
  it('finds a card through an AI catalog entry with a url', async () => {
    const env = fakeEnv({
      '/.well-known/ard.json': {
        entries: [
          { type: MCP_CARD_TYPE, url: 'https://example.com/mcp/server-card' },
        ],
      },
      'https://example.com/mcp/server-card': {
        name: 'a',
        version: '1',
        remotes: [{ url: 'https://example.com/mcp' }],
      },
    });
    const result = await checkMcpServerCard(env);
    expect(result.passed).toBe(true);
  });
  it('finds a card embedded as data in the older ai-catalog.json', async () => {
    const env = fakeEnv({
      '/.well-known/ai-catalog.json': {
        entries: [
          {
            type: MCP_CARD_TYPE,
            data: {
              name: 'a',
              version: '1',
              remotes: [{ url: 'https://e.com/m' }],
            },
          },
          { type: 'text/plain', data: {} },
        ],
      },
    });
    const result = await checkMcpServerCard(env);
    expect(result.passed).toBe(true);
  });
  it('ignores a catalog entry whose card is invalid', async () => {
    const env = fakeEnv({
      '/.well-known/ard.json': {
        entries: [{ type: MCP_CARD_TYPE, data: { name: 'a' } }],
      },
    });
    const result = await checkMcpServerCard(env);
    expect(result.passed).toBe(false);
  });
  it('fails without a transport endpoint', async () => {
    const env = fakeEnv({
      '/.well-known/mcp/server-card.json': { serverInfo: mcpCard.serverInfo },
    });
    const result = await checkMcpServerCard(env);
    expect(result.detail).toContain('transport endpoint');
  });
  it('fails without a version', async () => {
    const env = fakeEnv({
      '/.well-known/mcp/server-card.json': {
        ...mcpCard,
        serverInfo: { name: 'x' },
      },
    });
    const result = await checkMcpServerCard(env);
    expect(result.passed).toBe(false);
  });
  it('fails when no card exists', async () => {
    const result = await checkMcpServerCard(fakeEnv());
    expect(result.passed).toBe(false);
  });
});

const a2a = {
  name: 'Agent',
  description: 'd',
  version: '1',
  capabilities: {},
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [],
  supportedInterfaces: [
    {
      url: 'https://example.com/a2a',
      protocolBinding: 'JSONRPC',
      protocolVersion: '1.0',
    },
  ],
};

describe('checkA2aAgentCard', () => {
  it('passes with a 1.0 card', async () => {
    const result = await checkA2aAgentCard(
      fakeEnv({ '/.well-known/agent-card.json': a2a }),
    );
    expect(result.passed).toBe(true);
  });
  it('accepts the pre-1.0 top-level url and the legacy path', async () => {
    const env = fakeEnv({
      '/.well-known/agent.json': {
        ...without(a2a, 'supportedInterfaces'),
        url: 'https://example.com/a2a',
      },
    });
    const result = await checkA2aAgentCard(env);
    expect(result.passed).toBe(true);
  });
  it('lists every missing field', async () => {
    const env = fakeEnv({ '/.well-known/agent-card.json': { name: 'x' } });
    const r = await checkA2aAgentCard(env);
    expect(r.detail).toContain(
      'description, version, capabilities, defaultInputModes, defaultOutputModes, skills, supportedInterfaces',
    );
  });
  it('requires url, protocolBinding and protocolVersion on each interface', async () => {
    const env = fakeEnv({
      '/.well-known/agent-card.json': {
        ...a2a,
        supportedInterfaces: [{ url: 'https://e.com' }],
      },
    });
    const result = await checkA2aAgentCard(env);
    expect(result.detail).toContain('protocolBinding');
    const empty = fakeEnv({
      '/.well-known/agent-card.json': { ...a2a, supportedInterfaces: [] },
    });
    const emptyResult = await checkA2aAgentCard(empty);
    expect(emptyResult.passed).toBe(false);
  });
  it('fails when absent', async () => {
    const result = await checkA2aAgentCard(fakeEnv());
    expect(result.passed).toBe(false);
  });
});

const skill = {
  name: 'my-skill',
  type: 'skill-md',
  description: 'd',
  url: '/s/SKILL.md',
  digest: `sha256:${'a'.repeat(64)}`,
};

describe('skillProblems', () => {
  it('accepts a valid skill', () => {
    expect(skillProblems(skill)).toEqual([]);
  });
  it('rejects bad names', () => {
    for (const name of [
      'Upper',
      '-lead',
      'trail-',
      'dou--ble',
      '',
      'a'.repeat(65),
    ]) {
      expect(skillProblems({ ...skill, name })).toHaveLength(1);
    }
  });
  it('accepts the archive type only besides skill-md', () => {
    expect(skillProblems({ ...skill, type: 'archive' })).toEqual([]);
    expect(skillProblems({ ...skill, type: 'zip' })).toHaveLength(1);
  });
  it('limits the description to 1024 characters', () => {
    expect(
      skillProblems({ ...skill, description: 'x'.repeat(1025) }),
    ).toHaveLength(1);
  });
  it('requires a url and a sha256:<64 hex> digest', () => {
    expect(skillProblems(without(skill, 'url'))).toHaveLength(1);
    expect(skillProblems({ ...skill, digest: 'sha256:abc' })).toHaveLength(1);
    expect(skillProblems({ ...skill, digest: 'a'.repeat(64) })).toHaveLength(1);
  });
  it('rejects a non-object', () => {
    expect(skillProblems('x')).toEqual(['is not an object']);
  });
});

describe('checkSkills', () => {
  it('passes with the v0.2.0 schema and valid skills', async () => {
    const env = fakeEnv({
      '/.well-known/agent-skills/index.json': {
        $schema: SKILLS_SCHEMA,
        skills: [skill],
      },
    });
    const result = await checkSkills(env);
    expect(result.passed).toBe(true);
  });
  it('reads an index without $schema as v0.1.0', async () => {
    const env = fakeEnv({
      '/.well-known/agent-skills/index.json': { skills: [skill] },
    });
    const result = await checkSkills(env);
    expect(result.passed).toBe(true);
  });
  it('falls back to /.well-known/skills/index.json', async () => {
    const env = fakeEnv({
      '/.well-known/skills/index.json': { skills: [skill] },
    });
    const result = await checkSkills(env);
    expect(result.passed).toBe(true);
  });
  it('refuses an unrecognised $schema', async () => {
    const env = fakeEnv({
      '/.well-known/agent-skills/index.json': {
        $schema: 'https://x/9.json',
        skills: [skill],
      },
    });
    const result = await checkSkills(env);
    expect(result.detail).toContain('$schema');
  });
  it('fails for an invalid skill and names the problem', async () => {
    const env = fakeEnv({
      '/.well-known/agent-skills/index.json': {
        skills: [without(skill, 'digest')],
      },
    });
    const result = await checkSkills(env);
    expect(result.detail).toContain('digest must be sha256');
  });
  it('fails for an empty list and for nothing', async () => {
    const emptyList = await checkSkills(
      fakeEnv({ '/.well-known/agent-skills/index.json': { skills: [] } }),
    );
    expect(emptyList.detail).toContain('no skills');
    const nothing = await checkSkills(fakeEnv());
    expect(nothing.passed).toBe(false);
  });
});
