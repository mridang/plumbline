import { describe, expect, it } from '@jest/globals';
import {
  checkAuthMd,
  isIdentifierUrl,
  checkOauthDiscovery,
  checkOauthProtectedResource,
} from '../../../src/lib/agent/oauth.js';
import { fakeEnv } from './fake-env.js';
import { HTTP_SCHEME } from '../../helpers/data.js';

describe('isIdentifierUrl', () => {
  it('accepts https URLs and http loopback hosts', () => {
    expect(isIdentifierUrl('https://example.com/issuer1')).toBe(true);
    expect(isIdentifierUrl('http://127.0.0.1:3000')).toBe(true);
  });
  it('rejects http, query, fragment, junk and non-strings', () => {
    for (const v of [
      `${HTTP_SCHEME}example.com`,
      'https://e.com/?a=1',
      'https://e.com/#f',
      'nope',
      1,
    ]) {
      expect(isIdentifierUrl(v)).toBe(false);
    }
  });
});

describe('checkOauthDiscovery with a JSON 404 fallback', () => {
  const notFound = {
    status: 404,
    contentType: 'application/json',
    body: '{"error":"not_found"}',
  };
  it('passes when only oauth-authorization-server is valid', async () => {
    const env = fakeEnv(
      {
        '/.well-known/oauth-authorization-server': {
          issuer: 'https://example.com',
        },
      },
      { fallback: notFound },
    );
    const r = await checkOauthDiscovery(env);
    expect(r.passed).toBe(true);
    expect(r.detail).toContain('oauth-authorization-server');
  });
  it('passes when openid-configuration has no issuer but the other is valid', async () => {
    const env = fakeEnv({
      '/.well-known/openid-configuration': {},
      '/.well-known/oauth-authorization-server': {
        issuer: 'https://example.com',
      },
    });
    const r = await checkOauthDiscovery(env);
    expect(r.passed).toBe(true);
  });
  it('names both paths when both fail', async () => {
    const r = await checkOauthDiscovery(fakeEnv({}, { fallback: notFound }));
    expect(r.passed).toBe(false);
    expect(r.detail).toBe(
      '/.well-known/openid-configuration was not found (HTTP 404); /.well-known/oauth-authorization-server was not found (HTTP 404).',
    );
  });
});

describe('checkOauthDiscovery', () => {
  it('passes with OIDC metadata', async () => {
    const env = fakeEnv({
      '/.well-known/openid-configuration': { issuer: 'https://example.com' },
    });
    const r = await checkOauthDiscovery(env);
    expect(r.passed).toBe(true);
  });
  it('falls back to RFC 8414 metadata', async () => {
    const env = fakeEnv({
      '/.well-known/oauth-authorization-server': {
        issuer: 'https://example.com',
      },
    });
    const r = await checkOauthDiscovery(env);
    expect(r.passed).toBe(true);
  });
  it('fails for an issuer with a query or plain http', async () => {
    for (const issuer of [
      'https://example.com/?a=1',
      `${HTTP_SCHEME}example.com`,
    ]) {
      const env = fakeEnv({ '/.well-known/openid-configuration': { issuer } });
      const r = await checkOauthDiscovery(env);
      expect(r.passed).toBe(false);
    }
  });
  it('fails for an invalid issuer', async () => {
    const env = fakeEnv({
      '/.well-known/openid-configuration': { issuer: 'not a url' },
    });
    const r = await checkOauthDiscovery(env);
    expect(r.detail).toContain('no valid issuer');
  });
  it('fails for a non-JSON answer or nothing', async () => {
    const html = await checkOauthDiscovery(
      fakeEnv({ '/.well-known/openid-configuration': '<html>' }),
    );
    expect(html.passed).toBe(false);
    const none = await checkOauthDiscovery(fakeEnv());
    expect(none.passed).toBe(false);
  });
});

describe('checkOauthProtectedResource', () => {
  const path = '/.well-known/oauth-protected-resource';
  it('passes when the resource is the site, ignoring www', async () => {
    const env = fakeEnv({
      [path]: { resource: 'https://www.example.com' },
    });
    const r = await checkOauthProtectedResource(env);
    expect(r.passed).toBe(true);
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
    const r = await checkOauthProtectedResource(env);
    expect(r.passed).toBe(true);
  });
  it('fails for a resource at a path, as the scanner does', async () => {
    const env = fakeEnv({
      [path]: { resource: 'https://example.com/api/mcp' },
    });
    const outcome = await checkOauthProtectedResource(env);
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toContain(
      '/.well-known/oauth-protected-resource/api/mcp',
    );
  });
  it('fails for a resource with a fragment', async () => {
    const env = fakeEnv({ [path]: { resource: 'https://example.com/#x' } });
    const r = await checkOauthProtectedResource(env);
    expect(r.passed).toBe(false);
  });
  it('fails for another host', async () => {
    const env = fakeEnv({ [path]: { resource: 'https://other.com/api' } });
    const r = await checkOauthProtectedResource(env);
    expect(r.detail).toContain('not on');
  });
  it('fails without a resource URL', async () => {
    const r = await checkOauthProtectedResource(fakeEnv({ [path]: {} }));
    expect(r.detail).toContain('no valid resource');
  });
  it('fails when missing', async () => {
    const r = await checkOauthProtectedResource(fakeEnv());
    expect(r.passed).toBe(false);
  });
});

describe('checkAuthMd', () => {
  it('passes with /auth.md', async () => {
    const r = await checkAuthMd(fakeEnv({ '/auth.md': '# Auth' }));
    expect(r.passed).toBe(true);
  });
  it('rejects an HTML soft 404 and an empty file', async () => {
    const html = await checkAuthMd(
      fakeEnv({ '/auth.md': { contentType: 'text/html', body: '<html>' } }),
    );
    expect(html.passed).toBe(false);
    const empty = await checkAuthMd(fakeEnv({ '/auth.md': ' ' }));
    expect(empty.passed).toBe(false);
  });
  it('passes with an agent_auth block in the metadata', async () => {
    const env = fakeEnv({
      '/.well-known/oauth-authorization-server': {
        issuer: 'x',
        agent_auth: {},
      },
    });
    const r = await checkAuthMd(env);
    expect(r.passed).toBe(true);
  });
  it('fails when nothing exists', async () => {
    const r = await checkAuthMd(fakeEnv());
    expect(r.passed).toBe(false);
  });
});
