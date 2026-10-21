import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/technical/technical-heading-hierarchy.js';
import { runHint } from '../../helpers/run-hint.js';

/** Routes for a valid page whose head and body are filled in by the test. */
const page = (body: string, head = '') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body>${body}</body></html>`,
  },
});

describe('technical-heading-hierarchy', () => {
  it('passes with ordered headings', async () => {
    expect(await runHint(hint, page('<h1>a</h1><h2>b</h2><h3>c</h3>'))).toEqual(
      [],
    );
  });
  it('warns on a skipped level', async () => {
    const problems = await runHint(
      hint,
      page('<h1>a</h1><h2>b</h2><h4>c</h4>'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('h2 is directly followed by h4');
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
