import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headersx/service-worker-allowed.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('service-worker-allowed', () => {
  it('is silent when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('passes for a path scope', async () => {
    expect(
      await runHint(hint, page({ 'service-worker-allowed': '/app/' })),
    ).toEqual([]);
  });

  it('warns on a relative scope', async () => {
    const problems = await runHint(
      hint,
      page({ 'service-worker-allowed': 'app/' }),
    );
    expect(problems[0].message).toContain("starting with '/'");
  });
});
