import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/alt-svc.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('alt-svc', () => {
  it('passes for clear', async () => {
    expect(await runHint(hint, page({ 'alt-svc': 'clear' }))).toEqual([]);
  });

  it('notes advertised protocols', async () => {
    const problems = await runHint(
      hint,
      page({ 'alt-svc': 'h3=":443"; ma=2592000, h2=":443"' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('h3');
  });

  it('warns on a malformed value', async () => {
    const problems = await runHint(hint, page({ 'alt-svc': 'garbage' }));
    expect(problems[0].message).toContain('clear');
  });
});
