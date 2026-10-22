import { describe, expect, it } from '@jest/globals';
import { checkWebBotAuth } from '../../../src/lib/agent/bot-auth.js';
import { fakeEnv } from './fake-env.js';

const path = '/.well-known/http-message-signatures-directory';

describe('checkWebBotAuth', () => {
  it('passes with a key directory', async () => {
    expect(
      (await checkWebBotAuth(fakeEnv({ [path]: { keys: [{ kty: 'OKP' }] } })))
        .passed,
    ).toBe(true);
  });
  it('fails for an empty directory', async () => {
    expect(
      (await checkWebBotAuth(fakeEnv({ [path]: { keys: [] } }))).detail,
    ).toContain('no keys');
  });
  it('fails for an HTML soft 404', async () => {
    const env = fakeEnv({
      [path]: { contentType: 'text/html', body: '<html>' },
    });
    expect((await checkWebBotAuth(env)).passed).toBe(false);
  });
  it('fails when missing', async () => {
    expect((await checkWebBotAuth(fakeEnv())).passed).toBe(false);
  });
});
