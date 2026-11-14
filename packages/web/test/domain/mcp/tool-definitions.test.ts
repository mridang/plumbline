import { describe, expect, it } from '@jest/globals';
import Ajv2020 from 'ajv/dist/2020.js';

import { unsupportedKeywords, validateJson, type JsonSchema } from '@/lib/mcp';
import { TOOLS, toolNamed } from '@/domain/mcp/tool-definitions';
import {
  CHECKS_PAGE_DEFAULT,
  CHECKS_PAGE_MAX,
} from '@/domain/mcp/tools/schemas';
import {
  APP_RESOURCES,
  DOMAIN_LIST_RESOURCE_URI,
  REPORT_RESOURCE_URI,
} from '@/domain/mcp/ui-resources';
import { SCOPE_READ, scopeForTool } from '@/lib/oauth';

/** A JSON Schema 2020-12 validator that rejects schemas with unknown keywords. */
function newAjv(): Ajv2020 {
  return new Ajv2020({ strict: true, allowUnionTypes: true });
}

/** Arguments that every tool accepts, one set per tool. */
const GOOD_ARGUMENTS: Readonly<Record<string, Record<string, unknown>>> = {
  list_checks: { group: 'tls', query: 'hsts', limit: 20, offset: 10 },
  list_domains: {},
  list_repositories: {},
  get_domain: { domain: 'example.com' },
  get_report: {
    domain: 'https://example.com/',
    report: '00000000-0000-4000-8000-000000000001',
  },
  list_reports: { domain: 'example.com' },
  scan_domain: { domain: 'example.com' },
  remove_domain: { domain: 'example.com' },
  configure_checks: {
    domain: 'example.com',
    all: true,
    enable: ['tls'],
    disable: ['csp'],
  },
};

/** The input schema of a tool, as the checker types it. */
function inputOf(name: string): JsonSchema {
  return toolNamed(name)?.inputSchema as unknown as JsonSchema;
}

/** The `_meta` of a tool, as a plain record. */
function metaOf(name: string): Readonly<Record<string, unknown>> {
  return (toolNamed(name)?._meta ?? {}) as Readonly<Record<string, unknown>>;
}

describe('the tool catalogue', () => {
  it('lists the tools in a fixed order', () => {
    expect(TOOLS.map((t) => t.name)).toEqual([
      'list_checks',
      'list_domains',
      'list_repositories',
      'get_domain',
      'get_report',
      'list_reports',
      'scan_domain',
      'remove_domain',
      'configure_checks',
    ]);
  });

  it('has a unique, valid name for every tool', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
    }
  });

  it('has a set of good arguments for every tool, and for no other', () => {
    expect(
      Object.keys(GOOD_ARGUMENTS).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(TOOLS.map((t) => t.name).toSorted((a, b) => a.localeCompare(b)));
  });

  it('finds a tool by name', () => {
    expect(toolNamed('get_report')?.name).toBe('get_report');
  });

  it.each(['make_coffee', 'constructor', ''])(
    'finds no tool called %j',
    (name) => {
      expect(toolNamed(name)).toBeUndefined();
    },
  );

  it('describes what each tool does without telling the model how to behave', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.description).not.toMatch(
        /YOURSELF|do NOT|Call this when|Use this when|Use it|prefer /,
      );
    }
  });

  it('says in the description of list_checks how many a page holds', () => {
    expect(toolNamed('list_checks')?.description).toContain(
      `${CHECKS_PAGE_DEFAULT} at a time`,
    );
  });

  it('caps a page of checks above its default', () => {
    expect(CHECKS_PAGE_MAX).toBeGreaterThan(CHECKS_PAGE_DEFAULT);
  });
});

describe('the input schemas', () => {
  it.each(TOOLS.map((t) => [t.name, t] as const))(
    '%s is a closed object schema that Ajv compiles in strict mode',
    (_name, tool) => {
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
      expect(() => newAjv().compile(tool.inputSchema)).not.toThrow();
    },
  );

  it.each(TOOLS.map((t) => [t.name] as const))(
    '%s uses only keywords the server’s own checker acts on',
    (name) => {
      expect(unsupportedKeywords(inputOf(name))).toEqual([]);
    },
  );

  it.each(Object.entries(GOOD_ARGUMENTS))(
    '%s accepts its good arguments, by the server’s checker and by Ajv',
    (name, args) => {
      expect(validateJson(inputOf(name), args)).toEqual([]);
      expect(newAjv().validate(inputOf(name), args)).toBe(true);
    },
  );

  it.each(
    TOOLS.filter(
      (t) =>
        t.name !== 'list_checks' &&
        t.name !== 'list_domains' &&
        t.name !== 'list_repositories',
    ).map((t) => [t.name] as const),
  )('%s requires a domain', (name) => {
    expect(inputOf(name).required).toEqual(['domain']);
  });

  it.each(['get_domain', 'configure_checks'])(
    '%s refuses a blank domain',
    (name) => {
      expect(
        validateJson(inputOf(name), { domain: ' '.repeat(3) }),
      ).not.toEqual([]);
    },
  );

  it('refuses a page of checks larger than the cap', () => {
    expect(
      validateJson(inputOf('list_checks'), { limit: CHECKS_PAGE_MAX + 1 }),
    ).not.toEqual([]);
  });

  it('refuses a negative offset', () => {
    expect(validateJson(inputOf('list_checks'), { offset: -1 })).not.toEqual(
      [],
    );
  });

  it('refuses a blank check name', () => {
    expect(
      validateJson(inputOf('configure_checks'), {
        domain: 'example.com',
        enable: [' '],
      }),
    ).not.toEqual([]);
  });

  it('takes no arguments for list_repositories', () => {
    expect(
      validateJson(inputOf('list_repositories'), { domain: 'x' }),
    ).not.toEqual([]);
    expect(validateJson(inputOf('list_repositories'), {})).toEqual([]);
  });

  it('takes no arguments for list_domains', () => {
    expect(validateJson(inputOf('list_domains'), { domain: 'x' })).not.toEqual(
      [],
    );
  });
});

describe('the Views', () => {
  it('draws the domain list for list_domains', () => {
    expect(metaOf('list_domains')['ui']).toEqual({
      resourceUri: DOMAIN_LIST_RESOURCE_URI,
    });
  });

  it('draws the report for get_report', () => {
    expect(metaOf('get_report')['ui']).toEqual({
      resourceUri: REPORT_RESOURCE_URI,
    });
  });

  it('gives each UI tool a View that exists, in all three forms, and an output schema', () => {
    const uris = APP_RESOURCES.map((r) => r.uri) as readonly string[];
    const withViews = TOOLS.filter((tool) => 'ui' in tool._meta);
    expect(withViews.map((t) => t.name)).toEqual([
      'list_domains',
      'get_report',
    ]);
    for (const tool of withViews) {
      const meta = metaOf(tool.name);
      const uri = (meta['ui'] as { resourceUri: string }).resourceUri;
      expect(uris).toContain(uri);
      expect(meta['openai/outputTemplate']).toBe(uri);
      expect(meta['ui/resourceUri']).toBe(uri);
      expect(tool).toHaveProperty('outputSchema');
    }
  });

  it('keeps the words a host shows while a tool runs within 64 characters', () => {
    for (const tool of TOOLS.filter((t) => 'ui' in t._meta)) {
      const meta = metaOf(tool.name);
      for (const words of [
        meta['openai/toolInvocation/invoking'],
        meta['openai/toolInvocation/invoked'],
      ]) {
        expect(String(words).length).toBeGreaterThan(3);
        expect(String(words).length).toBeLessThanOrEqual(64);
      }
    }
  });

  it.each(
    TOOLS.filter((t) => 'outputSchema' in t).map((t) => [t.name, t] as const),
  )('%s has an output schema Ajv compiles in strict mode', (_name, tool) => {
    expect(() =>
      newAjv().compile((tool as { outputSchema: object }).outputSchema),
    ).not.toThrow();
  });

  it('lets a View call back only get_report, the read tool the domain list reads from', () => {
    const callable = TOOLS.filter((t) => 'openai/widgetAccessible' in t._meta);
    expect(callable.map((t) => t.name)).toEqual(['get_report']);
  });
});

describe('what each tool says about signing in', () => {
  it.each(TOOLS.map((t) => [t.name, t] as const))(
    '%s asks for the scope the server will check for it',
    (name, tool) => {
      const expected = [{ type: 'oauth2', scopes: [scopeForTool(name)] }];
      expect(tool.securitySchemes).toEqual(expected);
      expect(tool._meta['securitySchemes']).toEqual(expected);
    },
  );
});

describe('what the model has to read', () => {
  it('stays within a budget for names, descriptions and input schemas', () => {
    const size = JSON.stringify(
      TOOLS.map(({ name, title, description, inputSchema }) => ({
        name,
        title,
        description,
        inputSchema,
      })),
    ).length;
    expect(size).toBeLessThan(16_000);
  });
});

describe('titles and annotations', () => {
  it('gives every tool a title, repeated in its annotations', () => {
    for (const tool of TOOLS) {
      expect(tool.title.length).toBeGreaterThan(3);
      expect(tool.annotations.title).toBe(tool.title);
    }
  });

  it('marks a tool read-only exactly when its token scope is read-only', () => {
    for (const tool of TOOLS) {
      expect(tool.annotations.readOnlyHint).toBe(
        scopeForTool(tool.name) === SCOPE_READ,
      );
    }
  });

  it('flags only remove_domain as destructive', () => {
    expect(
      TOOLS.filter((t) => t.annotations.destructiveHint).map((t) => t.name),
    ).toEqual(['remove_domain']);
  });

  it('flags no tool as reaching the open world', () => {
    expect(TOOLS.filter((t) => t.annotations.openWorldHint)).toEqual([]);
  });

  it('flags every tool as safe to repeat', () => {
    expect(TOOLS.every((t) => t.annotations.idempotentHint)).toBe(true);
  });
});
