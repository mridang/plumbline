import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/x-powered-by.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('x-powered-by', () => {
  it('passes when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('reports the header when present', async () => {
    const problems = await runHint(hint, page({ 'x-powered-by': 'Express' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('X-Powered-By: Express');
  });
});
