import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/feeds/feed-discovery.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (head: string) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body></body></html>`,
  },
});

describe('feed-discovery', () => {
  it('passes when a feed is declared with an absolute href', async () => {
    const problems = await runHint(
      hint,
      page(
        '<link rel="alternate" type="application/rss+xml" href="https://x.test/f.xml">',
      ),
    );
    expect(problems).toEqual([]);
  });

  it('reports a missing feed at hint severity', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain('No RSS or Atom feed');
  });

  it('warns about a relative feed href against the offending element', async () => {
    const problems = await runHint(
      hint,
      page('<link rel="alternate" type="application/atom+xml" href="/a.xml">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].sourceCode).toContain('a.xml');
  });
});
