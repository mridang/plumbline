import { describe, expect, it } from '@jest/globals';
import { checkWebMcp, WEBMCP_SCRIPT } from '../../../src/lib/agent/webmcp.js';
import { fakeEnv } from './fake-env.js';

const withPage = (value: unknown) =>
  fakeEnv({}, { evaluate: () => Promise.resolve(value) });

describe('checkWebMcp', () => {
  it('passes with registered tools', async () => {
    const r = await checkWebMcp(withPage({ api: true, tools: 2, forms: 0 }));
    expect(r.passed).toBe(true);
  });
  it('passes with declarative form tools', async () => {
    const r = await checkWebMcp(withPage({ api: false, tools: 0, forms: 1 }));
    expect(r.passed).toBe(true);
  });
  it('fails when the API exists but no tool is registered', async () => {
    const r = await checkWebMcp(withPage({ api: true, tools: 0, forms: 0 }));
    expect(r.passed).toBe(false);
  });
  it('fails for an unexpected result', async () => {
    const r = await checkWebMcp(withPage('nope'));
    expect(r.passed).toBe(false);
  });
  it('fails without a browser', async () => {
    const r = await checkWebMcp(fakeEnv());
    expect(r.detail).toContain('No browser');
  });
  it('fails when evaluation throws', async () => {
    const env = fakeEnv({}, { evaluate: () => Promise.reject(new Error('x')) });
    const r = await checkWebMcp(env);
    expect(r.detail).toContain('could not be evaluated');
  });
  it('looks for modelContext and toolname forms', () => {
    expect(WEBMCP_SCRIPT).toContain('document.modelContext');
    expect(WEBMCP_SCRIPT).toContain('getTools');
    expect(WEBMCP_SCRIPT).toContain('form[toolname]');
  });
});
