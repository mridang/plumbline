import { X509Certificate } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import {
  commonName,
  describeChain,
  formatCertificate,
} from '../../../src/lib/tls/certs.js';
import { fixture } from './local-server.js';

const der = async (name: string): Promise<Buffer> =>
  new X509Certificate(await fixture(name)).raw;

describe('commonName', () => {
  it('reads the CN', () => {
    expect(commonName('C=NL\nCN=example.test')).toBe('example.test');
  });

  it('falls back to a dash', () => {
    expect(commonName('O=Org')).toBe('-');
  });
});

describe('describeChain', () => {
  it('describes an RSA leaf', async () => {
    const [leaf] = describeChain([await der('rsa3072.pem')]);
    expect(leaf).toEqual({
      commonName: 'localhost',
      issuer: expect.any(String),
      key: { type: 'rsa', modulusLength: 3072 },
      signatureOid: '1.2.840.10045.4.3.2',
      isRoot: false,
    });
  });

  it('describes an EC leaf with its curve', async () => {
    const [leaf] = describeChain([await der('ec-secp224.pem')]);
    expect(leaf.key).toMatchObject({ type: 'ec', curve: 'secp224r1' });
  });

  it('describes an Ed25519 leaf', async () => {
    const [leaf] = describeChain([await der('ed25519.pem')]);
    expect(leaf.key.type).toBe('ed25519');
  });

  it('marks a self-issued certificate after the leaf as a root', async () => {
    const chain = describeChain([
      await der('rsa3072.pem'),
      await der('ca.pem'),
    ]);
    expect(chain.map((c) => c.isRoot)).toEqual([false, true]);
  });

  it('does not treat a self-signed leaf as a root', async () => {
    expect(describeChain([await der('ca.pem')])[0].isRoot).toBe(false);
  });
});

describe('formatCertificate', () => {
  it('lists subject, issuer, key and signature algorithm', async () => {
    const [leaf] = describeChain([await der('rsa3072.pem')]);
    expect(formatCertificate(leaf, 'RSA-3072', 'ecdsa-with-SHA256')).toBe(
      [
        'Subject: CN=localhost',
        `Issuer: CN=${leaf.issuer}`,
        'Public key: RSA-3072',
        'Signature algorithm: ecdsa-with-SHA256',
      ].join('\n'),
    );
  });
});
