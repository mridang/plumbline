import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/cors-expose-headers.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('cors-expose-headers', () => {
  it('passes for a benign list', async () => {
    expect(
      await runHint(
        hint,
        page({ 'access-control-expose-headers': 'Content-Length' }),
      ),
    ).toEqual([]);
  });

  it('warns when a sensitive header is exposed', async () => {
    const problems = await runHint(
      hint,
      page({ 'access-control-expose-headers': 'Set-Cookie' }),
    );
    expect(problems[0].message).toContain('Set-Cookie');
  });
});
