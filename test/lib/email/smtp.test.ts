import { connect } from 'node:net';
import { afterEach, describe, expect, it } from '@jest/globals';
import { probeStarttls, tlsVersionLevel } from '../../../src/lib/email/smtp.js';
import { startSmtp, type FakeSmtp, type SmtpOptions } from './fake-smtp.js';
import { TEST_CERT } from './test-cert.js';

let server: FakeSmtp | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** Probes `host` while the connection actually goes to a local fake server. */
async function probe(
  host: string,
  options: SmtpOptions = {},
  tlsOptions: { ca?: string } = {},
) {
  server = await startSmtp(options);
  const { port } = server;
  return probeStarttls(host, {
    connect: () => connect({ host: '127.0.0.1', port }),
    tlsOptions,
    timeoutMs: 3000,
  });
}

describe('probeStarttls', () => {
  it('negotiates TLS and reports the version and chain', async () => {
    const result = await probe('mail.example.test');
    expect(result.reachable).toBe(true);
    expect(result.starttls).toBe(true);
    expect(result.tlsVersion).toBe('TLSv1.3');
    expect(result.certificates).toHaveLength(1);
    expect(result.hostnameMatches).toBe(true);
    expect(result.error).toBeNull();
  });

  it('reports a self-signed certificate as untrusted', async () => {
    const result = await probe('mail.example.test');
    expect(result.trusted).toBe(false);
    expect(result.trustError).toBe('DEPTH_ZERO_SELF_SIGNED_CERT');
  });

  it('trusts a certificate signed by a configured CA', async () => {
    const result = await probe('mail.example.test', {}, { ca: TEST_CERT });
    expect(result.trusted).toBe(true);
    expect(result.trustError).toBeNull();
  });

  it('reports a host name that does not match, while the chain is trusted', async () => {
    const result = await probe('other.example.test', {}, { ca: TEST_CERT });
    expect(result.hostnameMatches).toBe(false);
    expect(result.trusted).toBe(true);
  });

  it('reports a TLS 1.2 server', async () => {
    const result = await probe('mail.example.test', { maxVersion: 'TLSv1.2' });
    expect(result.tlsVersion).toBe('TLSv1.2');
  });

  it('reports a server without STARTTLS', async () => {
    const result = await probe('mail.example.test', { starttls: false });
    expect(result.reachable).toBe(true);
    expect(result.starttls).toBe(false);
    expect(result.certificates).toEqual([]);
  });

  it('fails on an unexpected greeting', async () => {
    const result = await probe('mail.example.test', {
      greeting: '554 no service\r\n',
    });
    expect(result.reachable).toBe(false);
    expect(result.error).toContain('554');
  });

  it('fails when nothing listens', async () => {
    const result = await probeStarttls('mail.example.test', {
      connect: () => connect({ host: '127.0.0.1', port: 1 }),
      timeoutMs: 3000,
    });
    expect(result.reachable).toBe(false);
    expect(result.error).not.toBeNull();
  });

  it('fails when the server stays silent', async () => {
    const result = await probe('mail.example.test', { greeting: '220-more' });
    expect(result.reachable).toBe(false);
  }, 15000);
});

describe('tlsVersionLevel', () => {
  it('classifies TLS versions as Internet.nl does', () => {
    expect(tlsVersionLevel('TLSv1.3')).toBe('good');
    expect(tlsVersionLevel('TLSv1.2')).toBe('sufficient');
    expect(tlsVersionLevel('TLSv1.1')).toBe('insufficient');
    expect(tlsVersionLevel('TLSv1')).toBe('insufficient');
    expect(tlsVersionLevel('SSLv3')).toBe('insufficient');
    expect(tlsVersionLevel(null)).toBe('insufficient');
  });
});
