import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headersx/repr-digest.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('repr-digest', () => {
  it('is silent when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('passes for a valid sha-512 digest', async () => {
    expect(
      await runHint(hint, page({ 'repr-digest': 'sha-512=:AAAA:' })),
    ).toEqual([]);
  });

  it('warns when only an insecure algorithm is offered', async () => {
    const problems = await runHint(hint, page({ 'repr-digest': 'md5=:AA==:' }));
    expect(problems[0].message).toContain('insecure');
  });
});
