import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/cors-allow-headers.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('cors-allow-headers', () => {
  it('passes for a named list', async () => {
    expect(
      await runHint(
        hint,
        page({ 'access-control-allow-headers': 'Content-Type' }),
      ),
    ).toEqual([]);
  });

  it('warns on a wildcard', async () => {
    const problems = await runHint(
      hint,
      page({ 'access-control-allow-headers': '*' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('Access-Control-Allow-Headers: *');
  });
});
