import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/cors-allow-credentials.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('cors-allow-credentials', () => {
  it('passes when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('errors when true with a wildcard origin', async () => {
    const problems = await runHint(
      hint,
      page({
        'access-control-allow-credentials': 'true',
        'access-control-allow-origin': '*',
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('cannot be combined');
  });

  it('warns when true with a specific origin', async () => {
    const problems = await runHint(
      hint,
      page({
        'access-control-allow-credentials': 'true',
        'access-control-allow-origin': 'https://x.test',
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe(
      'Access-Control-Allow-Credentials: true',
    );
  });
});
