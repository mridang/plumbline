import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/x-dns-prefetch-control.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('x-dns-prefetch-control', () => {
  it('passes when the header is off', async () => {
    expect(
      await runHint(hint, page({ 'x-dns-prefetch-control': 'off' })),
    ).toEqual([]);
  });

  it('reports a missing header', async () => {
    const problems = await runHint(hint, page({}));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('X-DNS-Prefetch-Control: off');
    expect(problems[0].message).toContain('was not specified');
  });

  it('reports a header that is on', async () => {
    const problems = await runHint(
      hint,
      page({ 'x-dns-prefetch-control': 'on' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('X-DNS-Prefetch-Control: on');
    expect(problems[0].message).toContain("should be 'off'");
  });
});
