import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headersx/use-as-dictionary.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('use-as-dictionary', () => {
  it('is silent when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('passes for a dictionary with a match pattern', async () => {
    expect(
      await runHint(hint, page({ 'use-as-dictionary': 'match="/app/*"' })),
    ).toEqual([]);
  });

  it('warns when match is missing', async () => {
    const problems = await runHint(
      hint,
      page({ 'use-as-dictionary': 'id="v1"' }),
    );
    expect(problems[0].message).toContain('match');
  });
});
