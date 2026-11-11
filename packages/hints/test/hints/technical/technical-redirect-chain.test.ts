import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/technical/technical-redirect-chain.js';
import { runHint } from '../../helpers/run-hint.js';

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
      // eslint-disable-next-line unicorn/prefer-https -- test fixture
      resource: 'http://a.example/',
      response: {
        // eslint-disable-next-line unicorn/prefer-https -- test fixture
        hops: ['http://a.example/', 'http://b.example/', 'http://c.example/'],
        // eslint-disable-next-line unicorn/prefer-https -- test fixture
        url: 'http://d.example/',
        statusCode: 200,
      },
    });
    expect(reports).toHaveLength(1);
    expect(reports[0].options.codeLanguage).toBe('http');
    expect(reports[0].options.codeSnippet).toBe(
      // eslint-disable-next-line unicorn/prefer-https -- test fixture
      'http://a.example/\n-> http://b.example/\n-> http://c.example/\n-> http://d.example/ (HTTP 200)',
    );
  });
});
