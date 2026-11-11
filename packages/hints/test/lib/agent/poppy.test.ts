import { describe, expect, it } from '@jest/globals';
import { checkPoppy } from '../../../src/lib/agent/poppy.js';
import { fakeEnv, without } from './fake-env.js';
import { HTTP_SCHEME } from '../../helpers/data.js';

const doc = {
  protocol_version: '0.1',
  organization: { name: 'Example', domain: 'example.com' },
  web: {},
};
const path = '/.well-known/poppy.json';

describe('checkPoppy', () => {
  it('passes with a valid manifest', async () => {
    const r = await checkPoppy(fakeEnv({ [path]: doc }));
    expect(r.passed).toBe(true);
  });
  it('matches the domain ignoring www', async () => {
    const env = fakeEnv({
      [path]: {
        ...doc,
        organization: { name: 'E', domain: 'www.example.com' },
      },
    });
    const r = await checkPoppy(env);
    expect(r.passed).toBe(true);
  });
  it('rejects plain http except on loopback hosts', async () => {
    const http = fakeEnv(
      { [path]: doc },
      { origin: `${HTTP_SCHEME}example.com` },
    );
    const httpResult = await checkPoppy(http);
    expect(httpResult.detail).toContain('HTTPS');
    const local = fakeEnv(
      { [path]: { ...doc, organization: { name: 'E', domain: '127.0.0.1' } } },
      { origin: 'http://127.0.0.1:3000' },
    );
    const localResult = await checkPoppy(local);
    expect(localResult.passed).toBe(true);
  });
  it('rejects a wrong protocol version, organization, domain or surface', async () => {
    const version = await checkPoppy(
      fakeEnv({ [path]: { ...doc, protocol_version: '1' } }),
    );
    expect(version.detail).toContain('0.1');
    const noDomain = await checkPoppy(
      fakeEnv({ [path]: { ...doc, organization: { name: 'E' } } }),
    );
    expect(noDomain.detail).toContain('organization needs');
    const mismatch = await checkPoppy(
      fakeEnv({
        [path]: {
          ...doc,
          organization: { name: 'E', domain: 'other.com' },
        },
      }),
    );
    expect(mismatch.detail).toContain('does not match');
    const noSurface = await checkPoppy(
      fakeEnv({ [path]: without(doc, 'web') }),
    );
    expect(noSurface.detail).toContain('agent, apis or web');
  });
  it('requires auth.issuer to match the RFC 8414 metadata', async () => {
    const withAuth = { ...doc, auth: { issuer: 'https://auth.example.com' } };
    const meta =
      'https://auth.example.com/.well-known/oauth-authorization-server';
    const ok = fakeEnv({
      [path]: withAuth,
      [meta]: {
        issuer: 'https://auth.example.com',
        poppy_domains: ['example.com'],
      },
    });
    const okResult = await checkPoppy(ok);
    expect(okResult.passed).toBe(true);
    const noDomain = fakeEnv({
      [path]: withAuth,
      [meta]: {
        issuer: 'https://auth.example.com',
        poppy_domains: ['other.com'],
      },
    });
    const noDomainResult = await checkPoppy(noDomain);
    expect(noDomainResult.detail).toContain('poppy_domains');
    const bad = fakeEnv({
      [path]: withAuth,
      [meta]: { issuer: 'https://evil.example' },
    });
    const badResult = await checkPoppy(bad);
    expect(badResult.detail).toContain('auth.issuer');
    const missingMeta = await checkPoppy(fakeEnv({ [path]: withAuth }));
    expect(missingMeta.passed).toBe(false);
  });
  it('fails when missing', async () => {
    const r = await checkPoppy(fakeEnv());
    expect(r.detail).toContain('/.well-known/poppy.json was not found');
  });
});
