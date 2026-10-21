import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/technical/technical-image-weight.js';
import { runHint } from '../../helpers/run-hint.js';

/** Routes for a valid page whose head and body are filled in by the test. */
const page = (body: string, head = '') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body>${body}</body></html>`,
  },
});

describe('technical-image-weight', () => {
  const big = (kb: number) => ({
    headers: { 'content-type': 'image/png' },
    body: 'a'.repeat(kb * 1024),
  });
  const imgs =
    '<img src="/small.png"><img src="/mid.png"><img src="/huge.png"><img src="/missing.png">';
  it('passes with small images', async () => {
    expect(
      await runHint(hint, {
        ...page('<img src="/small.png">'),
        '/small.png': big(10),
      }),
    ).toEqual([]);
  });
  it('warns over 200 KB and errors over 500 KB, ignoring unreachable images', async () => {
    const problems = await runHint(hint, {
      ...page(imgs),
      '/small.png': big(10),
      '/mid.png': big(250),
      '/huge.png': big(600),
    });
    expect(problems).toHaveLength(2);
    const mid = problems.find((p) => p.message.includes('/mid.png'));
    const huge = problems.find((p) => p.message.includes('/huge.png'));
    expect(mid?.severity).toBe(Severity.warning);
    expect(huge?.severity).toBe(Severity.error);
  });

  it('reports against the image with its size as the snippet', async () => {
    const problems = await runHint(hint, {
      ...page('<img src="/mid.png">'),
      '/mid.png': big(250),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].resource).toMatch(/\/mid\.png$/);
    expect(problems[0].sourceCode).toBe('250.0 KB (256000 bytes)');
  });
});
