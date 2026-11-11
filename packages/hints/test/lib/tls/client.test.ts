import { afterEach, describe, expect, it } from '@jest/globals';
import {
  acceptedCiphers,
  fetchCertificate,
  highestLegacyVersion,
  mailTargetFor,
  resourceFor,
  supportedVersions,
  targetFor,
  tlsProbe,
  tryConnect,
} from '../../../src/lib/tls/client.js';
import {
  OCSP_STAPLE,
  pointAt,
  pointAtMail,
  restoreProbe,
  startMailServer,
  startServer,
} from './local-server.js';

afterEach(restoreProbe);

const at = (port: number) => ({ host: '127.0.0.1', port });

describe('tryConnect', () => {
  it('reports a trusted handshake', async () => {
    const server = await startServer();
    pointAt(server.port);
    const result = await tryConnect(at(server.port), {});
    await server.close();
    expect(result).toMatchObject({
      protocol: 'TLSv1.3',
      authorized: true,
      authorizationError: null,
      ocspResponse: null,
    });
    // The leaf, then the CA that the connection was verified against.
    expect(result?.chain).toHaveLength(2);
  });

  it('reports why a certificate is not trusted', async () => {
    const server = await startServer();
    pointAt(server.port, false);
    const result = await tryConnect(at(server.port), {});
    await server.close();
    expect(result?.authorized).toBe(false);
    expect(result?.authorizationError).toBe('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    expect(result?.chain).toHaveLength(1);
  });

  it('returns null when nothing listens', async () => {
    const server = await startServer();
    const port = server.port;
    await server.close();
    expect(await tryConnect(at(port), {})).toBeNull();
  });

  it('returns null when the handshake is refused', async () => {
    const server = await startServer({ maxVersion: 'TLSv1.2' });
    const result = await tryConnect(at(server.port), {
      minVersion: 'TLSv1.3',
    });
    await server.close();
    expect(result).toBeNull();
  });

  it('reports the ephemeral key of an ECDHE suite', async () => {
    const server = await startServer({ maxVersion: 'TLSv1.2' });
    const result = await tryConnect(at(server.port), {
      ciphers: 'ECDHE-RSA-AES128-GCM-SHA256',
      ecdhCurve: 'secp384r1',
    });
    await server.close();
    expect(result?.ephemeral).toEqual({
      type: 'ECDH',
      size: 384,
      name: 'secp384r1',
    });
    expect(result?.cipher.standardName).toBe(
      'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
    );
  });

  it('has no ephemeral key for plain RSA key exchange', async () => {
    const server = await startServer({ maxVersion: 'TLSv1.2' });
    const result = await tryConnect(at(server.port), {
      ciphers: 'AES128-SHA',
    });
    await server.close();
    expect(result?.ephemeral).toBeNull();
  });

  it('reports a stapled OCSP response when asked', async () => {
    const server = await startServer();
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- Node's OCSPRequest event only accepts its response through this callback
    server.server.on('OCSPRequest', (_cert, _issuer, callback) =>
      // eslint-disable-next-line promise/prefer-await-to-callbacks -- Node's OCSPRequest event only accepts its response through this callback
      callback(null, OCSP_STAPLE),
    );
    const result = await tryConnect(at(server.port), { requestOCSP: true });
    await server.close();
    expect(result?.ocspResponse?.toString('hex')).toBe('30030a0100');
  });

  it('passes the signature algorithms to the handshake', async () => {
    // Default security level: a server will not sign with SHA-1 at all.
    const strict = await startServer({
      maxVersion: 'TLSv1.2',
      ciphers: 'DEFAULT',
    });
    const lenient = await startServer({
      maxVersion: 'TLSv1.2',
      sigalgs: 'RSA+SHA1:ECDSA+SHA1',
    });
    const options = {
      maxVersion: 'TLSv1.2' as const,
      ciphers: 'ECDHE',
      sigalgs: 'RSA+SHA1:ECDSA+SHA1',
    };
    const refused = await tryConnect(at(strict.port), options);
    const accepted = await tryConnect(at(lenient.port), options);
    await strict.close();
    await lenient.close();
    expect(refused).toBeNull();
    expect(accepted).not.toBeNull();
  });
});

describe('supportedVersions', () => {
  it('finds every version the server accepts', async () => {
    const server = await startServer();
    const versions = await supportedVersions(at(server.port));
    await server.close();
    expect(versions).toEqual(['TLSv1.3', 'TLSv1.2', 'TLSv1.1', 'TLSv1']);
  });

  it('finds only the versions in range', async () => {
    const server = await startServer({
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.2',
    });
    const versions = await supportedVersions(at(server.port));
    await server.close();
    expect(versions).toEqual(['TLSv1.2']);
  });
});

describe('acceptedCiphers', () => {
  it('lists every suite below TLS 1.3 with its key exchange', async () => {
    const server = await startServer({
      maxVersion: 'TLSv1.2',
      ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:AES128-SHA:@SECLEVEL=0',
    });
    const found = await acceptedCiphers(at(server.port), 'TLSv1.2');
    await server.close();
    expect(
      found.map((c) => c.standardName).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual([
      'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
      'TLS_RSA_WITH_AES_128_CBC_SHA',
    ]);
    expect(found.every((c) => c.version === 'TLSv1.2')).toBe(true);
    expect(found.find((c) => c.name === 'AES128-SHA')?.ephemeral).toBeNull();
  });

  it('lists the TLS 1.3 suites', async () => {
    const server = await startServer({ minVersion: 'TLSv1.3' });
    const found = await acceptedCiphers(at(server.port), 'TLSv1.3');
    await server.close();
    expect(found.map((c) => c.standardName)).toEqual([
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
    ]);
  });

  it('finds nothing when the version is refused', async () => {
    const server = await startServer({ maxVersion: 'TLSv1.2' });
    expect(await acceptedCiphers(at(server.port), 'TLSv1.3')).toEqual([]);
    await server.close();
  });
});

describe('helpers', () => {
  it('picks the highest version below TLS 1.3', () => {
    expect(highestLegacyVersion(['TLSv1.3', 'TLSv1.1', 'TLSv1.2'])).toBe(
      'TLSv1.2',
    );
    expect(highestLegacyVersion(['TLSv1.3', 'TLSv1'])).toBe('TLSv1');
    expect(highestLegacyVersion(['TLSv1.3'])).toBeNull();
    expect(highestLegacyVersion([])).toBeNull();
  });

  it('targets the host on the probe port', () => {
    // eslint-disable-next-line unicorn/prefer-https -- test fixture
    expect(targetFor(new URL('http://example.test:8080/x'))).toEqual({
      host: 'example.test',
      port: 443,
    });
    tlsProbe.port = 8443;
    expect(targetFor(new URL('http://[::1]/'))).toEqual({
      host: '::1',
      port: 8443,
    });
  });

  it('names the resource of a target', () => {
    expect(resourceFor({ host: 'example.test', port: 443 })).toBe(
      'https://example.test/',
    );
    expect(resourceFor({ host: '::1', port: 8443 })).toBe(
      'https://[::1]:8443/',
    );
  });
});

describe('fetchCertificate', () => {
  it('uses the defaults when they work', async () => {
    const server = await startServer();
    const result = await fetchCertificate(at(server.port));
    await server.close();
    expect(result?.protocol).toBe('TLSv1.3');
  });

  it('retries with TLS 1.2 and more curves for a weak curve certificate', async () => {
    const server = await startServer({ cert: 'ec-secp224' });
    const defaults = await tryConnect(at(server.port), {});
    const result = await fetchCertificate(at(server.port));
    await server.close();
    expect(defaults).toBeNull();
    expect(result?.protocol).toBe('TLSv1.2');
    expect(result?.peerCertificate.subject.CN).toBe('localhost');
  });

  it('returns null when nothing listens', async () => {
    const server = await startServer();
    const port = server.port;
    await server.close();
    expect(await fetchCertificate(at(port))).toBeNull();
  });
});

describe('mailTargetFor', () => {
  it('targets the SMTP port with a STARTTLS upgrade', () => {
    expect(mailTargetFor('mx.example.test')).toEqual({
      host: 'mx.example.test',
      port: 25,
      starttls: 'smtp',
    });
  });

  it('follows the probe settings', () => {
    pointAtMail(2525);
    expect(mailTargetFor('mx.example.test').port).toBe(2525);
  });
});

describe('tryConnect with a STARTTLS target', () => {
  it('upgrades the plain connection and reports the handshake', async () => {
    const server = await startMailServer();
    pointAtMail(server.port);
    const result = await tryConnect(mailTargetFor('127.0.0.1'), {});
    expect(result).toMatchObject({ protocol: 'TLSv1.3', authorized: true });
    expect(result?.chain).toHaveLength(2);
    expect(server.upgrades()).toBe(1);
    await server.close();
  });

  it('upgrades again for every probe', async () => {
    const server = await startMailServer({ maxVersion: 'TLSv1.2' });
    pointAtMail(server.port);
    expect(await supportedVersions(mailTargetFor('127.0.0.1'))).toEqual([
      'TLSv1.2',
      'TLSv1.1',
      'TLSv1',
    ]);
    expect(server.upgrades()).toBeGreaterThanOrEqual(4);
    await server.close();
  });

  it('returns null when the server does not offer STARTTLS', async () => {
    const server = await startMailServer({ starttls: false });
    pointAtMail(server.port);
    expect(await tryConnect(mailTargetFor('127.0.0.1'), {})).toBeNull();
    expect(server.upgrades()).toBe(0);
    await server.close();
  });

  it('returns null when nothing listens', async () => {
    const server = await startMailServer();
    pointAtMail(server.port);
    await server.close();
    expect(await tryConnect(mailTargetFor('127.0.0.1'), {})).toBeNull();
  });
});
