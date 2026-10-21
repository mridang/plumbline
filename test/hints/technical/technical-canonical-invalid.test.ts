import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/technical/technical-canonical-invalid.js';
import { runHint } from '../../helpers/run-hint.js';

/** Routes for a valid page whose head and body are filled in by the test. */
const page = (body: string, head = '') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body>${body}</body></html>`,
  },
});

describe('technical-canonical-invalid', () => {
  it('passes with an absolute canonical', async () => {
    expect(
      await runHint(
        hint,
        page('', '<link rel="canonical" href="https://a.test/x">'),
      ),
    ).toEqual([]);
  });
  it('ignores a missing canonical', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });
  it('accepts a relative canonical', async () => {
    expect(
      await runHint(hint, page('', '<link rel="canonical" href="/x">')),
    ).toEqual([]);
  });
  it('errors on a canonical that cannot be resolved', async () => {
    const problems = await runHint(
      hint,
      page('', '<link rel="canonical" href="http://">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('not a valid URL');
    expect(problems[0].severity).toBe(Severity.error);
  });
});
