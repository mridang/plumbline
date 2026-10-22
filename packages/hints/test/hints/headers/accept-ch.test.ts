import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/accept-ch.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('accept-ch', () => {
  it('passes when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('notes a valid token list', async () => {
    const problems = await runHint(hint, page({ 'accept-ch': 'Sec-CH-UA' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('fingerprinting');
  });

  it('warns on a malformed token', async () => {
    const problems = await runHint(hint, page({ 'accept-ch': 'bad token' }));
    expect(problems[0].message).toContain('client-hint tokens');
  });
});
