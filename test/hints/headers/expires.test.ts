import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/expires.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('expires', () => {
  it('passes for a valid HTTP-date', async () => {
    expect(
      await runHint(hint, page({ expires: 'Wed, 21 Oct 2015 07:28:00 GMT' })),
    ).toEqual([]);
  });

  it('notes redundancy when max-age is present', async () => {
    const problems = await runHint(
      hint,
      page({
        expires: 'Wed, 21 Oct 2015 07:28:00 GMT',
        'cache-control': 'max-age=60',
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('max-age');
  });

  it('warns on a malformed date', async () => {
    const problems = await runHint(hint, page({ expires: '0' }));
    expect(problems[0].message).toContain('HTTP-date');
  });
});
