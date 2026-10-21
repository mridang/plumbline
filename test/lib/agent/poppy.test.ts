import { describe, expect, it } from '@jest/globals';
import { checkPoppy } from '../../../src/lib/agent/poppy.js';
import { fakeEnv, without } from './fake-env.js';

const doc = {
  protocol_version: '0.1',
  organization: { name: 'Example', domain: 'example.com' },
  web: {},
};
const path = '/.well-known/poppy.json';

describe('checkPoppy', () => {
  it('passes with a valid manifest', async () => {
    expect((await checkPoppy(fakeEnv({ [path]: doc }))).passed).toBe(true);
  });
  it('matches the domain ignoring www', async () => {
    const env = fakeEnv({
      [path]: {
        ...doc,
        organization: { name: 'E', domain: 'www.example.com' },
      },
    });
    expect((await checkPoppy(env)).passed).toBe(true);
  });
  it('rejects plain http except on loopback hosts', async () => {
    const http = fakeEnv({ [path]: doc }, { origin: 'http://example.com' });
    expect((await checkPoppy(http)).detail).toContain('HTTPS');
    const local = fakeEnv(
      { [path]: { ...doc, organization: { name: 'E', domain: '127.0.0.1' } } },
      { origin: 'http://127.0.0.1:3000' },
    );
    expect((await checkPoppy(local)).passed).toBe(true);
  });
  it('rejects a wrong protocol version, organization, domain or surface', async () => {
    expect(
      (await checkPoppy(fakeEnv({ [path]: { ...doc, protocol_version: '1' } })))
        .detail,
    ).toContain('0.1');
    expect(
      (
        await checkPoppy(
          fakeEnv({ [path]: { ...doc, organization: { name: 'E' } } }),
        )
      ).detail,
    ).toContain('organization needs');
    expect(
      (
        await checkPoppy(
          fakeEnv({
            [path]: {
              ...doc,
              organization: { name: 'E', domain: 'other.com' },
            },
          }),
        )
      ).detail,
    ).toContain('does not match');
    expect(
      (await checkPoppy(fakeEnv({ [path]: without(doc, 'web') }))).detail,
    ).toContain('agent, apis or web');
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
    expect((await checkPoppy(ok)).passed).toBe(true);
    const noDomain = fakeEnv({
      [path]: withAuth,
      [meta]: {
        issuer: 'https://auth.example.com',
        poppy_domains: ['other.com'],
      },
    });
    expect((await checkPoppy(noDomain)).detail).toContain('poppy_domains');
    const bad = fakeEnv({
      [path]: withAuth,
      [meta]: { issuer: 'https://evil.example' },
    });
    expect((await checkPoppy(bad)).detail).toContain('auth.issuer');
    expect((await checkPoppy(fakeEnv({ [path]: withAuth }))).passed).toBe(
      false,
    );
  });
  it('fails when missing', async () => {
    expect((await checkPoppy(fakeEnv())).detail).toContain('No poppy.json');
  });
});
