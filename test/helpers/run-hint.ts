import { createRequire } from 'node:module';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { Analyzer, Configuration } from 'hint';
import type { Problem } from '@hint/utils-types';
import type { HintDefinition } from '../../src/core/define-hint.js';
import TestConnector from './test-connector.js';

const require = createRequire(import.meta.url);
const { default: HTMLParser } = require('@hint/parser-html');

/** What the test server answers for one path. */
interface Route {
  status?: number;
  headers?: Record<string, string | string[]>;
  body?: string;
}

/** Routes by path; `/` defaults to an empty HTML page. */
export type Routes = Record<string, Route | ((req: IncomingMessage) => Route)>;

const DEFAULT_PAGE =
  '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>';

function listen(routes: Routes): Promise<Server> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? '/').split('?')[0];
    const entry = routes[path];
    const route =
      typeof entry === 'function'
        ? entry(req)
        : (entry ??
          (path === '/'
            ? {
                headers: { 'content-type': 'text/html; charset=utf-8' },
                body: DEFAULT_PAGE,
              }
            : { status: 404, body: 'not found' }));
    res.writeHead(route.status ?? 200, {
      'content-type': 'text/html; charset=utf-8',
      ...route.headers,
    });
    res.end(route.body ?? '');
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(server)),
  );
}

/**
 * Runs one real webhint scan of a local server with only the given hint
 * switched on and returns the problems it reported.
 */
export async function runHint(
  hint: HintDefinition,
  routes: Routes = {},
  options: { hintOptions?: unknown } = {},
): Promise<Problem[]> {
  const server = await listen(routes);
  const { port } = server.address() as AddressInfo;
  const hintKey = `extra/${hint.id}`;
  try {
    const configuration = Configuration.fromConfig({
      connector: { name: 'test', options: {} },
      hints: {
        [hintKey]: options.hintOptions
          ? ['default', options.hintOptions]
          : 'default',
      },
      parsers: ['html'],
    });
    // The constructor is marked private, but it is the only way to hand
    // the analyzer a connector and hints that are not installed packages.
    const analyzer = Reflect.construct(Analyzer, [
      configuration,
      {
        connector: TestConnector,
        formatters: [],
        hints: [hint.ctor],
        incompatible: [],
        missing: [],
        parsers: [HTMLParser],
      },
      [],
    ]) as Analyzer;
    const [result] = await analyzer.analyze(`http://127.0.0.1:${port}/`);
    return result.problems;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
