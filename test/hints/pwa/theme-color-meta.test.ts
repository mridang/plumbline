import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/pwa/theme-color-meta.js';
import { runHint } from '../../helpers/run-hint.js';

function page(head: string) {
  return {
    '/': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>A fine title</title>${head}</head><body><h1>Hi</h1></body></html>`,
    },
  };
}

describe('theme-color-meta', () => {
  it('passes with a theme-color meta', async () => {
    expect(
      await runHint(hint, page('<meta name="theme-color" content="#fff">')),
    ).toEqual([]);
  });

  it('hints when the theme-color meta is missing', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('theme-color');
    expect(problems[0].sourceCode).toContain('theme-color');
  });
});
