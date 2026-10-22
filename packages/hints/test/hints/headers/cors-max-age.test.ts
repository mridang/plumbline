import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/cors-max-age.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('cors-max-age', () => {
  it('passes for a reasonable value', async () => {
    expect(
      await runHint(hint, page({ 'access-control-max-age': '600' })),
    ).toEqual([]);
  });

  it('warns on a non-integer', async () => {
    const problems = await runHint(
      hint,
      page({ 'access-control-max-age': 'ten' }),
    );
    expect(problems[0].message).toContain('whole number');
  });

  it('notes an excessive cache', async () => {
    const problems = await runHint(
      hint,
      page({ 'access-control-max-age': '999999' }),
    );
    expect(problems).toHaveLength(1);
  });
});
