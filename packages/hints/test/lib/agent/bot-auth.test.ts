import { describe, expect, it } from '@jest/globals';
import { checkWebBotAuth } from '../../../src/lib/agent/bot-auth.js';
import { fakeEnv } from './fake-env.js';

const path = '/.well-known/http-message-signatures-directory';

describe('checkWebBotAuth', () => {
  it('passes with a key directory', async () => {
    const result = await checkWebBotAuth(
      fakeEnv({ [path]: { keys: [{ kty: 'OKP' }] } }),
    );
    expect(result.passed).toBe(true);
  });
  it('fails for an empty directory', async () => {
    const result = await checkWebBotAuth(fakeEnv({ [path]: { keys: [] } }));
    expect(result.detail).toContain('no keys');
  });
  it('fails for an HTML soft 404', async () => {
    const env = fakeEnv({
      [path]: { contentType: 'text/html', body: '<html>' },
    });
    const result = await checkWebBotAuth(env);
    expect(result.passed).toBe(false);
  });
  it('fails when missing', async () => {
    const result = await checkWebBotAuth(fakeEnv());
    expect(result.passed).toBe(false);
  });
});
