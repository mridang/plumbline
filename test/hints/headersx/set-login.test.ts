import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headersx/set-login.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('set-login', () => {
  it('is silent when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('passes for logged-in', async () => {
    expect(await runHint(hint, page({ 'set-login': 'logged-in' }))).toEqual([]);
  });

  it('warns on an invalid value', async () => {
    const problems = await runHint(hint, page({ 'set-login': 'maybe' }));
    expect(problems[0].message).toContain('logged-in');
  });
});
