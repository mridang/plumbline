import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headersx/speculation-rules.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('speculation-rules', () => {
  it('is silent when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('passes for a quoted ruleset URL', async () => {
    expect(
      await runHint(hint, page({ 'speculation-rules': '"/rules.json"' })),
    ).toEqual([]);
  });

  it('warns on a bare member', async () => {
    const problems = await runHint(
      hint,
      page({ 'speculation-rules': '/rules.json' }),
    );
    expect(problems[0].message).toContain('quoted');
  });
});
