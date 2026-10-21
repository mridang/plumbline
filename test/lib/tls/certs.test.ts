import { X509Certificate } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { commonName, describeChain } from '../../../src/lib/tls/certs.js';
import { fixture } from './local-server.js';

const der = (name: string): Buffer => new X509Certificate(fixture(name)).raw;

describe('commonName', () => {
  it('reads the CN', () => {
    expect(commonName('C=NL\nCN=example.test')).toBe('example.test');
  });

  it('falls back to a dash', () => {
    expect(commonName('O=Org')).toBe('-');
  });
});

describe('describeChain', () => {
  it('describes an RSA leaf', () => {
    const [leaf] = describeChain([der('rsa3072.pem')]);
    expect(leaf).toEqual({
      commonName: 'localhost',
      key: { type: 'rsa', modulusLength: 3072, curve: undefined },
      signatureOid: '1.2.840.10045.4.3.2',
      isRoot: false,
    });
  });

  it('describes an EC leaf with its curve', () => {
    const [leaf] = describeChain([der('ec-secp224.pem')]);
    expect(leaf.key).toMatchObject({ type: 'ec', curve: 'secp224r1' });
  });

  it('describes an Ed25519 leaf', () => {
    const [leaf] = describeChain([der('ed25519.pem')]);
    expect(leaf.key.type).toBe('ed25519');
  });

  it('marks a self-issued certificate after the leaf as a root', () => {
    const chain = describeChain([der('rsa3072.pem'), der('ca.pem')]);
    expect(chain.map((c) => c.isRoot)).toEqual([false, true]);
  });

  it('does not treat a self-signed leaf as a root', () => {
    expect(describeChain([der('ca.pem')])[0].isRoot).toBe(false);
  });
});
