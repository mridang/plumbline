import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/timing-allow-origin.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('timing-allow-origin', () => {
  it('passes for a valid origin list', async () => {
    expect(
      await runHint(
        hint,
        page({ 'timing-allow-origin': 'https://a.test, https://b.test' }),
      ),
    ).toEqual([]);
  });

  it('warns on a wildcard', async () => {
    const problems = await runHint(hint, page({ 'timing-allow-origin': '*' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('Timing-Allow-Origin: *');
  });
});
