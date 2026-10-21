import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/technical/technical-image-alt-coverage.js';
import { runHint } from '../../helpers/run-hint.js';

/** Routes for a valid page whose head and body are filled in by the test. */
const page = (body: string, head = '') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body>${body}</body></html>`,
  },
});

describe('technical-image-alt-coverage', () => {
  it('passes when every image has alt', async () => {
    expect(
      await runHint(hint, page('<img src="/a" alt=""><img src="/b" alt="b">')),
    ).toEqual([]);
  });
  it('warns at 80 percent coverage', async () => {
    const body = '<img src="/a" alt="a">'.repeat(4) + '<img src="/b">';
    const problems = await runHint(hint, page(body));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('1 of 5');
    expect(problems[0].severity).toBe(Severity.warning);
  });
  it('errors below 80 percent coverage', async () => {
    const problems = await runHint(
      hint,
      page('<img src="/a"><img src="/b" alt="b">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
  });

  it('points at an image without alt', async () => {
    const problems = await runHint(hint, page('<img src="/a.png">'));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toContain('<img src="/a.png">');
    expect(problems[0].location.line).toBeGreaterThanOrEqual(0);
  });
});
