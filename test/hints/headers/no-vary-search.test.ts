import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/no-vary-search.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('no-vary-search', () => {
  it('passes for recognised keys', async () => {
    expect(
      await runHint(hint, page({ 'no-vary-search': 'key-order' })),
    ).toEqual([]);
  });

  it('warns on an unknown key', async () => {
    const problems = await runHint(hint, page({ 'no-vary-search': 'wobble' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('wobble');
  });
});
