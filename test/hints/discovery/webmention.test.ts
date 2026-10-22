import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/discovery/webmention.js';
import { runHint } from '../../helpers/run-hint.js';

const html = (head: string) =>
  `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body></body></html>`;

const page = (head: string, headers: Record<string, string> = {}) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: html(head),
  },
});

describe('webmention', () => {
  it('is silent when no endpoint is advertised', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });

  it('reports an absolute endpoint in the DOM', async () => {
    const problems = await runHint(
      hint,
      page('<link rel="webmention" href="https://x.test/wm">'),
    );
    expect(problems[0].message).toContain('Webmention endpoint');
  });

  it('warns on a relative endpoint', async () => {
    const problems = await runHint(
      hint,
      page('<link rel="webmention" href="/wm">'),
    );
    expect(problems[0].message).toContain('absolute');
  });

  it('reads the endpoint from the Link header', async () => {
    const problems = await runHint(
      hint,
      page('', { link: '<https://x.test/wm>; rel="webmention"' }),
    );
    expect(problems[0].message).toContain('Webmention endpoint');
  });
});
