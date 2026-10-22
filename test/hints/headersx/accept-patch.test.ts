import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headersx/accept-patch.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('accept-patch', () => {
  it('is silent when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('passes for a media-type list', async () => {
    expect(
      await runHint(
        hint,
        page({ 'accept-patch': 'application/json-patch+json' }),
      ),
    ).toEqual([]);
  });

  it('warns on a non media-type', async () => {
    const problems = await runHint(hint, page({ 'accept-patch': 'nonsense' }));
    expect(problems[0].message).toContain('Accept-Patch');
  });
});
