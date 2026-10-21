import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/technical/technical-twitter-card-type.js';
import { runHint } from '../../helpers/run-hint.js';

/** Routes for a valid page whose head and body are filled in by the test. */
const page = (body: string, head = '') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body>${body}</body></html>`,
  },
});

describe('technical-twitter-card-type', () => {
  it('passes with a valid type', async () => {
    expect(
      await runHint(
        hint,
        page('', '<meta name="twitter:card" content="summary_large_image">'),
      ),
    ).toEqual([]);
  });
  it('ignores a missing tag', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });
  it('errors on an unknown type', async () => {
    const problems = await runHint(
      hint,
      page('', '<meta name="twitter:card" content="big">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain(
      '"big" is not a recognized card type',
    );
    expect(problems[0].severity).toBe(Severity.error);
  });
});
