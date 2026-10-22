import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/feeds/oembed-discovery.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (head: string) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body></body></html>`,
  },
});

describe('oembed-discovery', () => {
  it('passes when an oEmbed endpoint is declared', async () => {
    const problems = await runHint(
      hint,
      page(
        '<link rel="alternate" type="application/json+oembed" href="/o.json">',
      ),
    );
    expect(problems).toEqual([]);
  });

  it('reports a missing oEmbed endpoint at hint severity', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain('No oEmbed endpoint');
  });

  it('warns about a missing oEmbed href', async () => {
    const problems = await runHint(
      hint,
      page('<link rel="alternate" type="text/xml+oembed">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
