import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headersx/content-digest.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('content-digest', () => {
  it('is silent when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('passes for a valid sha-256 digest', async () => {
    expect(
      await runHint(hint, page({ 'content-digest': 'sha-256=:AAAA:' })),
    ).toEqual([]);
  });

  it('warns on a malformed digest', async () => {
    const problems = await runHint(
      hint,
      page({ 'content-digest': 'sha-256=abc' }),
    );
    expect(problems[0].message).toContain('byte sequence');
  });
});
