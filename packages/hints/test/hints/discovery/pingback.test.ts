import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/discovery/pingback.js';
import { runHint } from '../../helpers/run-hint.js';

const html = (head: string) =>
  `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body></body></html>`;

const page = (head: string, headers: Record<string, string> = {}) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: html(head),
  },
});

describe('pingback', () => {
  it('is silent when no pingback is advertised', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });

  it('flags a rel=pingback link as legacy', async () => {
    const problems = await runHint(
      hint,
      page('<link rel="pingback" href="https://x.test/xmlrpc">'),
    );
    expect(problems[0].message).toContain('Webmention');
  });

  it('flags an X-Pingback header', async () => {
    const problems = await runHint(
      hint,
      page('', { 'x-pingback': 'https://x.test/xmlrpc' }),
    );
    expect(problems[0].message).toContain('legacy');
  });
});
