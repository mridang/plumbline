import { describe, expect, it } from '@jest/globals';
import { checkWebMcp, WEBMCP_SCRIPT } from '../../../src/lib/agent/webmcp.js';
import { fakeEnv } from './fake-env.js';

const withPage = (value: unknown) =>
  fakeEnv({}, { evaluate: () => Promise.resolve(value) });

describe('checkWebMcp', () => {
  it('passes with registered tools', async () => {
    expect(
      (await checkWebMcp(withPage({ api: true, tools: 2, forms: 0 }))).passed,
    ).toBe(true);
  });
  it('passes with declarative form tools', async () => {
    expect(
      (await checkWebMcp(withPage({ api: false, tools: 0, forms: 1 }))).passed,
    ).toBe(true);
  });
  it('fails when the API exists but no tool is registered', async () => {
    expect(
      (await checkWebMcp(withPage({ api: true, tools: 0, forms: 0 }))).passed,
    ).toBe(false);
  });
  it('fails for an unexpected result', async () => {
    expect((await checkWebMcp(withPage('nope'))).passed).toBe(false);
  });
  it('fails without a browser', async () => {
    expect((await checkWebMcp(fakeEnv())).detail).toContain('No browser');
  });
  it('fails when evaluation throws', async () => {
    const env = fakeEnv({}, { evaluate: () => Promise.reject(new Error('x')) });
    expect((await checkWebMcp(env)).detail).toContain('could not be evaluated');
  });
  it('looks for modelContext and toolname forms', () => {
    expect(WEBMCP_SCRIPT).toContain('document.modelContext');
    expect(WEBMCP_SCRIPT).toContain('getTools');
    expect(WEBMCP_SCRIPT).toContain('form[toolname]');
  });
});
