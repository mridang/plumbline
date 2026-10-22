import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/integrity-policy.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('integrity-policy', () => {
  it('passes with a blocked-destinations list', async () => {
    expect(
      await runHint(
        hint,
        page({ 'integrity-policy': 'blocked-destinations=(script)' }),
      ),
    ).toEqual([]);
  });

  it('warns without blocked-destinations', async () => {
    const problems = await runHint(
      hint,
      page({ 'integrity-policy': 'sources=(inline)' }),
    );
    expect(problems[0].message).toContain('blocked-destinations');
  });
});
