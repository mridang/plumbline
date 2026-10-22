import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/via.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('via', () => {
  it('passes when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('reports a hop that names software', async () => {
    const problems = await runHint(hint, page({ via: '1.1 varnish' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('Via: 1.1 varnish');
  });
});
