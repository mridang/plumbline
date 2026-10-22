import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/age.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('age', () => {
  it('passes for delta-seconds', async () => {
    expect(await runHint(hint, page({ age: '60' }))).toEqual([]);
  });

  it('notes a malformed value', async () => {
    const problems = await runHint(hint, page({ age: '-1' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('Age: -1');
  });
});
