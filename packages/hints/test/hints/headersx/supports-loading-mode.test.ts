import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headersx/supports-loading-mode.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('supports-loading-mode', () => {
  it('is silent when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('passes for a known mode', async () => {
    expect(
      await runHint(
        hint,
        page({ 'supports-loading-mode': 'credentialed-prerender' }),
      ),
    ).toEqual([]);
  });

  it('warns on an unrecognised mode', async () => {
    const problems = await runHint(
      hint,
      page({ 'supports-loading-mode': 'teleport' }),
    );
    expect(problems[0].message).toContain('teleport');
  });
});
