import { describe, expect, it } from '@jest/globals';
import { checkMarkdownNegotiation } from '../../../src/lib/agent/markdown.js';
import { fakeEnv } from './fake-env.js';

describe('checkMarkdownNegotiation', () => {
  it('passes for text/markdown and reports the token count', async () => {
    const env = fakeEnv({
      '/ text/markdown': {
        contentType: 'text/markdown; charset=utf-8',
        headers: { 'x-markdown-tokens': '12' },
      },
    });
    const r = await checkMarkdownNegotiation(env);
    expect(r.passed).toBe(true);
    expect(r.detail).toContain('12 tokens');
  });
  it('passes without the token header', async () => {
    const env = fakeEnv({
      '/ text/markdown': { contentType: 'text/markdown' },
    });
    const r = await checkMarkdownNegotiation(env);
    expect(r.passed).toBe(true);
  });
  it('fails when HTML is returned', async () => {
    const env = fakeEnv({ '/ text/markdown': { contentType: 'text/html' } });
    const r = await checkMarkdownNegotiation(env);
    expect(r.passed).toBe(false);
  });
  it('fails when unreachable', async () => {
    const r = await checkMarkdownNegotiation(fakeEnv());
    expect(r.passed).toBe(false);
  });
});
