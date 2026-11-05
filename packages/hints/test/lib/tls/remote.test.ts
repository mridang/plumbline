import { describe, expect, it } from '@jest/globals';

import {
  remoteConnect,
  type RemoteHandshake,
  type RemoteRequest,
} from '../../../src/lib/tls/remote.js';

const answer = (over: Partial<RemoteHandshake> = {}): RemoteHandshake => ({
  protocol: 'TLSv1.2',
  cipher: {
    name: 'ECDHE-RSA-AES128-GCM-SHA256',
    standardName: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
  },
  authorized: true,
  authorizationError: null,
  chain: [
    Buffer.from('leaf').toString('base64'),
    Buffer.from('root').toString('base64'),
  ],
  certificates: [
    {
      subject: { CN: 'example.com' },
      issuer: { CN: 'Some CA' },
      subjectaltname: 'DNS:example.com',
      valid_from: 'Jan  1 00:00:00 2026 GMT',
      valid_to: 'Apr  1 00:00:00 2026 GMT',
      serialNumber: 'AB',
      fingerprint256: 'FF',
      keyType: 'EC',
      bits: 256,
      asn1Curve: 'P-256',
      signatureAlgorithm: 'ECDSA-SHA256',
    },
  ],
  ephemeral: { type: 'ECDH', size: 253, name: 'X25519' },
  ocsp: Buffer.from('ocsp').toString('base64'),
  ...over,
});

describe('remoteConnect', () => {
  it('asks the prober with the target and options and reads the answer as a probe result', async () => {
    const asked: RemoteRequest[] = [];
    const connect = remoteConnect(async (request) => {
      asked.push(request);
      return answer();
    });
    const result = await connect(
      { host: 'example.com', port: 443 },
      {
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.2',
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:@SECLEVEL=0',
        sigalgs: 'RSA+SHA256',
        ecdhCurve: 'prime256v1',
        requestOCSP: true,
      },
    );
    expect(asked).toEqual([
      {
        host: 'example.com',
        port: 443,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.2',
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:@SECLEVEL=0',
        sigalgs: 'RSA+SHA256',
        ecdhCurve: 'prime256v1',
        requestOCSP: true,
      },
    ]);
    expect(result).toMatchObject({
      protocol: 'TLSv1.2',
      authorized: true,
      ephemeral: { type: 'ECDH', size: 253, name: 'X25519' },
      cipher: { name: 'ECDHE-RSA-AES128-GCM-SHA256' },
    });
    expect(result.chain.map((der) => der.toString())).toEqual(['leaf', 'root']);
    expect(result.ocspResponse?.toString()).toBe('ocsp');
    expect(result.peerCertificate).toMatchObject({
      subject: { CN: 'example.com' },
      subjectaltname: 'DNS:example.com',
      valid_to: 'Apr  1 00:00:00 2026 GMT',
      bits: 256,
    });
    expect(result.peerCertificate.raw.toString()).toBe('leaf');
  });

  it('sends the STARTTLS mode of a mail server', async () => {
    const asked: RemoteRequest[] = [];
    await remoteConnect(async (request) => {
      asked.push(request);
      return answer();
    })({ host: 'mx.test', port: 25, starttls: 'smtp' }, {});
    expect(asked[0]).toMatchObject({ port: 25, starttls: 'smtp' });
  });

  it('reads a protocol it does not know as none', async () => {
    const result = await remoteConnect(async () =>
      answer({ protocol: 'SSLv3' }),
    )({ host: 'example.com', port: 443 }, {});
    expect(result.protocol).toBeNull();
  });

  it('lets a failed handshake reject', async () => {
    await expect(
      remoteConnect(async () => {
        throw new Error('timeout');
      })({ host: 'example.com', port: 443 }, {}),
    ).rejects.toThrow('timeout');
  });
});
