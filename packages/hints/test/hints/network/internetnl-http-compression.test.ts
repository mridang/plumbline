import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/network/internetnl-http-compression.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('internetnl-http-compression', () => {
  it('passes without Content-Encoding', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('gives information when the response is compressed', async () => {
    const problems = await runHint(
      hint,
      page({ 'content-encoding': 'x-custom' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('supports HTTP compression');
    expect(problems[0].sourceCode).toBe('Content-Encoding: x-custom');
    expect(problems[0].severity).toBe(Severity.hint);
  });
});
