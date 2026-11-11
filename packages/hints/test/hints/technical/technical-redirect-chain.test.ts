import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/technical/technical-redirect-chain.js';
import { runHint } from '../../helpers/run-hint.js';
import { HTTP_SCHEME } from '../../helpers/data.js';

/** Routes for a valid page whose head and body are filled in by the test. */
const page = (body: string, head = '') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body>${body}</body></html>`,
  },
});

describe('technical-redirect-chain', () => {
  it('passes without redirects', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });

  it('shows the chain as an http snippet', async () => {
    const handlers: Record<string, (event: unknown) => void> = {};
    const reports: { resource: string; options: Record<string, unknown> }[] =
      [];
    const context = {
      on: (name: string, handler: (event: unknown) => void) => {
        handlers[name] = handler;
      },
      report: (
        resource: string,
        _m: string,
        options: Record<string, unknown>,
      ) => reports.push({ resource, options }),
    };
    const instance = new hint.ctor(context as never);
    expect(instance).toBeInstanceOf(hint.ctor);
    handlers['fetch::end::html']({
      resource: `${HTTP_SCHEME}a.example/`,
      response: {
        hops: [
          `${HTTP_SCHEME}a.example/`,
          `${HTTP_SCHEME}b.example/`,
          `${HTTP_SCHEME}c.example/`,
        ],
        url: `${HTTP_SCHEME}d.example/`,
        statusCode: 200,
      },
    });
    expect(reports).toHaveLength(1);
    expect(reports[0].options.codeLanguage).toBe('http');
    expect(reports[0].options.codeSnippet).toBe(
      `${HTTP_SCHEME}a.example/\n-> ${HTTP_SCHEME}b.example/\n-> ${HTTP_SCHEME}c.example/\n-> ${HTTP_SCHEME}d.example/ (HTTP 200)`,
    );
  });
});
