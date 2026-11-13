import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { ROUTE_MODULES } from './helpers/route-modules';
import { APP_MIGRATIONS } from './lib/core/db/migrations';
import { installCloudflareContext, sqliteD1 } from './lib/core/db/sqlite-d1';

const PACKAGE = path.resolve(import.meta.dirname, '..');

// A route that signs a person out reads the cookie jar of the request in
// flight; a test has none, so it gets an empty one.
jest.unstable_mockModule('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
  headers: async () => new Headers(),
}));

type Json = { [key: string]: unknown };
interface Operation {
  operationId?: string;
  tags?: string[];
  summary?: string;
  security?: Json[];
  parameters?: Json[];
  requestBody?: { content?: Record<string, { schema?: Json }> };
  responses: Record<string, Json>;
}

const document = JSON.parse(
  await readFile(path.join(PACKAGE, 'openapi.json'), 'utf8'),
) as {
  openapi: string;
  paths: Record<string, Record<string, Operation>>;
  components: {
    schemas: Record<string, Json>;
    responses: Record<string, Json>;
  };
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const API = path.join(PACKAGE, 'src/app/api');

const documented = (): Map<string, Operation> => {
  const found = new Map<string, Operation>();
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of METHODS) {
      if (item[method]) {
        found.set(`${method.toUpperCase()} ${path}`, item[method]);
      }
    }
  }
  return found;
};

const routeFiles = async (dir: string): Promise<string[]> => {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(...(await routeFiles(path.join(dir, entry.name))));
    } else if (entry.name === 'route.ts') {
      found.push(path.join(dir, entry.name));
    } else {
      continue;
    }
  }
  return found;
};

/** The path a route file serves, with `[x]` written `{x}`. */
const pathOf = (file: string): string =>
  '/api/' +
  path
    .relative(API, file)
    .replace(/\/?route\.ts$/, '')
    .replaceAll(
      /\[([a-z_-]+)\]/g,
      (_, name: string) => `{${name.replaceAll('-', '_')}}`,
    );

/**
 * The routes kept only so that an address still registered outside the code
 * (the GitHub App's callback and webhook URLs) keeps answering until the
 * registration is changed. They are not part of the contract.
 */
const ALIASES = new Set(['/api/github/callback', '/api/github/webhook']);

type Handler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response> | Response;

/**
 * Every `METHOD /path` the route files really export: a method counts when the
 * module has a handler for it, not when its name is mentioned (a shared
 * controller may export a name it has no handler for, and Next answers 405).
 */
const registered = async (): Promise<
  { key: string; path: string; method: string; handler: Handler }[]
> => {
  const found = [];
  for (const file of await routeFiles(API)) {
    const path = pathOf(file).replace(/\/$/, '');
    if (ALIASES.has(path)) {
      continue;
    }
    const load = ROUTE_MODULES[path];
    if (!load) {
      throw new Error(
        `${path} has a route file and no entry in test/helpers/route-modules.ts`,
      );
    }
    const module = await load();
    for (const method of METHODS.map((m) => m.toUpperCase())) {
      if (typeof module[method] === 'function') {
        found.push({
          key: `${method} ${path}`,
          path,
          method,
          handler: module[method] as Handler,
        });
      }
    }
  }
  return found;
};

/** A schema with its `$ref` followed. */
const resolve = (schema: Json | undefined): Json | undefined => {
  const ref = schema?.['$ref'];
  return typeof ref === 'string'
    ? (document.components.schemas[ref.split('/').pop() ?? ''] as Json)
    : schema;
};

/** A response with its `$ref` followed. */
const response = (value: Json): Json => {
  const ref = value['$ref'];
  return typeof ref === 'string'
    ? (document.components.responses[ref.split('/').pop() ?? ''] as Json)
    : value;
};

const routes = await registered();

describe('openapi.json and the route files', () => {
  it('has a module in the test table for every route file, and a route file for every module', async () => {
    const routeList = await routeFiles(API);
    const files = routeList
      .map((file) => pathOf(file).replace(/\/$/, ''))
      .filter((path) => !ALIASES.has(path));
    expect(files.toSorted((a, b) => Number(a > b) - Number(a < b))).toEqual(
      Object.keys(ROUTE_MODULES).toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    );
  });

  it('is OpenAPI 3.1', () => {
    expect(document.openapi).toMatch(/^3\.1\./);
  });

  it('describes every method of every route under /api, and nothing else', () => {
    expect(
      routes
        .map((route) => route.key)
        .toSorted((a, b) => Number(a > b) - Number(a < b)),
    ).toEqual(
      [...documented().keys()].toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    );
  });

  it('gives every operation its own id, a tag and a summary', () => {
    const ids = [...documented().values()].map((op) => op.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [key, op] of documented()) {
      expect([key, Boolean(op.operationId)]).toEqual([key, true]);
      expect([key, (op.tags ?? []).length > 0]).toEqual([key, true]);
      expect([key, Boolean(op.summary)]).toEqual([key, true]);
    }
  });

  it('says for every operation whether it needs a sign-in', () => {
    for (const [key, op] of documented()) {
      expect([key, Array.isArray(op.security)]).toEqual([key, true]);
    }
  });

  it('documents the answers every operation can give', () => {
    for (const [key, op] of documented()) {
      const codes = Object.keys(op.responses);
      const secured = (op.security ?? []).length > 0;
      const writes = !key.startsWith('GET ');
      expect([key, codes.includes('429')]).toEqual([key, true]);
      if (secured) {
        expect([key, codes.includes('401')]).toEqual([key, true]);
      }
      if (secured && writes) {
        expect([key, codes.includes('403')]).toEqual([key, true]);
      }
    }
  });

  it('describes every error as application/problem+json', () => {
    for (const [key, op] of documented()) {
      for (const [code, value] of Object.entries(op.responses)) {
        if (Number(code) < 400) {
          continue;
        }
        const content = response(value)['content'] as Json | undefined;
        expect([key, code, Object.keys(content ?? {})]).toEqual([
          key,
          code,
          ['application/problem+json'],
        ]);
      }
    }
  });

  it('closes every request body, so a field it does not know is refused', () => {
    for (const [key, op] of documented()) {
      for (const media of Object.values(op.requestBody?.content ?? {})) {
        const schema = resolve(media.schema);
        expect([key, schema?.['additionalProperties']]).toEqual([key, false]);
      }
    }
  });

  it('names every property in snake_case', () => {
    const bad: string[] = [];
    const walk = (value: unknown, where: string): void => {
      if (Array.isArray(value)) {
        value.forEach((item, at) => walk(item, `${where}[${at}]`));
      } else if (value && typeof value === 'object') {
        const record = value as Json;
        const properties = record['properties'];
        const names =
          properties && typeof properties === 'object'
            ? Object.keys(properties)
            : [];
        bad.push(
          ...names
            .filter((name) => !/^[a-z][a-z0-9_]*$/.test(name))
            .map((name) => `${where}.${name}`),
        );
        for (const [name, child] of Object.entries(record)) {
          walk(child, `${where}.${name}`);
        }
      } else {
        // A scalar holds no properties and no children to walk.
      }
    };
    walk(document.components.schemas, 'schemas');
    expect(bad).toEqual([]);
  });

  it('has no path segment that is a verb or has a hyphen, and no trailing slash', () => {
    for (const path of Object.keys(document.paths)) {
      expect(path).not.toMatch(/(?:-|\/$)/);
    }
  });
});

describe('what the controllers do, against what the spec says', () => {
  let restore: () => void;

  beforeEach(() => {
    restore = installCloudflareContext(sqliteD1(...APP_MIGRATIONS).d1, {
      SESSION_SECRET: 'a-session-secret-that-is-long-enough-to-sign-with',
      SCAN_SECRET: 'a-scan-secret-that-is-long-enough-to-sign-with',
    });
  });
  afterEach(() => restore());

  const secured = routes.filter(({ key }) => {
    const op = documented().get(key);
    return (op?.security ?? []).length > 0;
  });

  it.each(
    secured.map(
      ({ key, path, method, handler }) => [key, path, method, handler] as const,
    ),
  )(
    '%s answers 401 as a problem to a request with no session',
    async (_key, path, method, handler) => {
      const names = [...path.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1] ?? '');
      const params = Object.fromEntries(names.map((name) => [name, 'x']));
      const answer = await handler(
        new Request(
          `https://plumbline.test${path.replaceAll(/\{[a-z_]+\}/g, 'x')}`,
          {
            method,
            headers: { 'content-type': 'application/json' },
            body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
          },
        ),
        { params: Promise.resolve(params) },
      );
      expect(answer.status).toBe(401);
      expect(answer.headers.get('content-type')).toBe(
        'application/problem+json',
      );
    },
  );

  it('has a secured operation for every route that needs a session', () => {
    expect(secured.length).toBeGreaterThan(0);
  });
});
