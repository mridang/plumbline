import { describe, expect, it } from '@jest/globals';
import {
  checkAuthMd,
  isIdentifierUrl,
  checkOauthDiscovery,
  checkOauthProtectedResource,
} from '../../../src/lib/agent/oauth.js';
import { fakeEnv } from './fake-env.js';

describe('isIdentifierUrl', () => {
  it('accepts https URLs and http loopback hosts', () => {
    expect(isIdentifierUrl('https://example.com/issuer1')).toBe(true);
    expect(isIdentifierUrl('http://127.0.0.1:3000')).toBe(true);
  });
  it('rejects http, query, fragment, junk and non-strings', () => {
    for (const v of [
      'http://example.com',
      'https://e.com/?a=1',
      'https://e.com/#f',
      'nope',
      1,
    ]) {
      expect(isIdentifierUrl(v)).toBe(false);
    }
  });
});

describe('checkOauthDiscovery', () => {
  it('passes with OIDC metadata', async () => {
    const env = fakeEnv({
      '/.well-known/openid-configuration': { issuer: 'https://example.com' },
    });
    expect((await checkOauthDiscovery(env)).passed).toBe(true);
  });
  it('falls back to RFC 8414 metadata', async () => {
    const env = fakeEnv({
      '/.well-known/oauth-authorization-server': {
        issuer: 'https://example.com',
      },
    });
    expect((await checkOauthDiscovery(env)).passed).toBe(true);
  });
  it('fails for an issuer with a query or plain http', async () => {
    for (const issuer of ['https://example.com/?a=1', 'http://example.com']) {
      const env = fakeEnv({ '/.well-known/openid-configuration': { issuer } });
      expect((await checkOauthDiscovery(env)).passed).toBe(false);
    }
  });
  it('fails for an invalid issuer', async () => {
    const env = fakeEnv({
      '/.well-known/openid-configuration': { issuer: 'not a url' },
    });
    expect((await checkOauthDiscovery(env)).detail).toContain(
      'no valid issuer',
    );
  });
  it('fails for a non-JSON answer or nothing', async () => {
    expect(
      (
        await checkOauthDiscovery(
          fakeEnv({ '/.well-known/openid-configuration': '<html>' }),
        )
      ).passed,
    ).toBe(false);
    expect((await checkOauthDiscovery(fakeEnv())).passed).toBe(false);
  });
});

describe('checkOauthProtectedResource', () => {
  const path = '/.well-known/oauth-protected-resource';
  it('passes when the resource is on the site, ignoring www', async () => {
    const env = fakeEnv({
      [path]: { resource: 'https://www.example.com/api' },
    });
    expect((await checkOauthProtectedResource(env)).passed).toBe(true);
  });
  it('follows resource_metadata from a WWW-Authenticate challenge', async () => {
    const env = fakeEnv({
      '/': {
        status: 401,
        headers: {
          'www-authenticate':
            'Bearer resource_metadata="https://example.com/meta.json"',
        },
      },
      'https://example.com/meta.json': { resource: 'https://example.com' },
    });
    expect((await checkOauthProtectedResource(env)).passed).toBe(true);
  });
  it('fails for a resource with a fragment', async () => {
    const env = fakeEnv({ [path]: { resource: 'https://example.com/#x' } });
    expect((await checkOauthProtectedResource(env)).passed).toBe(false);
  });
  it('fails for another host', async () => {
    const env = fakeEnv({ [path]: { resource: 'https://other.com/api' } });
    expect((await checkOauthProtectedResource(env)).detail).toContain('not on');
  });
  it('fails without a resource URL', async () => {
    expect(
      (await checkOauthProtectedResource(fakeEnv({ [path]: {} }))).detail,
    ).toContain('no valid resource');
  });
  it('fails when missing', async () => {
    expect((await checkOauthProtectedResource(fakeEnv())).passed).toBe(false);
  });
});

describe('checkAuthMd', () => {
  it('passes with /auth.md', async () => {
    expect((await checkAuthMd(fakeEnv({ '/auth.md': '# Auth' }))).passed).toBe(
      true,
    );
  });
  it('rejects an HTML soft 404 and an empty file', async () => {
    expect(
      (
        await checkAuthMd(
          fakeEnv({ '/auth.md': { contentType: 'text/html', body: '<html>' } }),
        )
      ).passed,
    ).toBe(false);
    expect((await checkAuthMd(fakeEnv({ '/auth.md': ' ' }))).passed).toBe(
      false,
    );
  });
  it('passes with an agent_auth block in the metadata', async () => {
    const env = fakeEnv({
      '/.well-known/oauth-authorization-server': {
        issuer: 'x',
        agent_auth: {},
      },
    });
    expect((await checkAuthMd(env)).passed).toBe(true);
  });
  it('fails when nothing exists', async () => {
    expect((await checkAuthMd(fakeEnv())).passed).toBe(false);
  });
});
