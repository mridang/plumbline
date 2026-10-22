import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/cors-allow-methods.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('cors-allow-methods', () => {
  it('passes for a known method list', async () => {
    expect(
      await runHint(
        hint,
        page({ 'access-control-allow-methods': 'GET, POST' }),
      ),
    ).toEqual([]);
  });

  it('warns on a wildcard', async () => {
    const problems = await runHint(
      hint,
      page({ 'access-control-allow-methods': '*' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('Access-Control-Allow-Methods: *');
  });

  it('warns on an unknown method', async () => {
    const problems = await runHint(
      hint,
      page({ 'access-control-allow-methods': 'GET, FOOBAR' }),
    );
    expect(problems[0].message).toContain('FOOBAR');
  });
});
