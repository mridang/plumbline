import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/technical/technical-robots-meta-advanced.js';
import { runHint } from '../../helpers/run-hint.js';

/** Routes for a valid page whose head and body are filled in by the test. */
const page = (body: string, head = '') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body>${body}</body></html>`,
  },
});

describe('technical-robots-meta-advanced', () => {
  const all = 'max-snippet:-1, max-image-preview:large, max-video-preview:-1';
  it('passes with every directive', async () => {
    expect(
      await runHint(hint, page('', `<meta name="robots" content="${all}">`)),
    ).toEqual([]);
  });
  it('warns when the tag is missing', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('No meta robots directives');
    expect(problems[0].severity).toBe(Severity.warning);
  });
  it('warns when no advanced directive is present', async () => {
    const problems = await runHint(
      hint,
      page('', '<meta name="robots" content="index, follow">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no advanced snippet/preview');
  });
  it('warns about the missing ones', async () => {
    const problems = await runHint(
      hint,
      page('', '<meta name="robots" content="max-snippet:-1">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain(
      'missing: max-image-preview, max-video-preview',
    );
  });
  it('leaves noindex pages to seo-robots-noindex', async () => {
    expect(
      await runHint(hint, page('', '<meta name="robots" content="noindex">')),
    ).toEqual([]);
  });
});
