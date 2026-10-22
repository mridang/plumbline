import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/last-modified.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('last-modified', () => {
  it('passes for a valid HTTP-date', async () => {
    expect(
      await runHint(
        hint,
        page({ 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' }),
      ),
    ).toEqual([]);
  });

  it('warns on a malformed date', async () => {
    const problems = await runHint(
      hint,
      page({ 'last-modified': '2015-10-21' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('Last-Modified: 2015-10-21');
  });
});
