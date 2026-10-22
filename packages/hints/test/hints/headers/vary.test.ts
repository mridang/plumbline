import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/vary.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('vary', () => {
  it('passes for a named list', async () => {
    expect(
      await runHint(hint, page({ vary: 'Accept-Encoding, Accept' })),
    ).toEqual([]);
  });

  it('warns on a bare wildcard', async () => {
    const problems = await runHint(hint, page({ vary: '*' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('Vary: *');
  });

  it('warns when mixing a wildcard with names', async () => {
    const problems = await runHint(hint, page({ vary: '*, Accept' }));
    expect(problems[0].message).toContain('mixes');
  });
});
