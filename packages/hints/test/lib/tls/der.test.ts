import { X509Certificate } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { signatureAlgorithmOid } from '../../../src/lib/tls/der.js';
import { fixture } from './local-server.js';

const der = async (name: string): Promise<Buffer> =>
  new X509Certificate(await fixture(name)).raw;

describe('signatureAlgorithmOid', () => {
  it.each([
    ['rsa-signed.pem', '1.2.840.113549.1.1.11'],
    ['rsa3072.pem', '1.2.840.10045.4.3.2'],
    ['rsa3072-sha1.pem', '1.2.840.10045.4.1'],
    ['rsa3072-sha224.pem', '1.2.840.10045.4.3.1'],
    ['ca.pem', '1.2.840.10045.4.3.2'],
  ])('reads the algorithm of %s', async (name, oid) => {
    expect(signatureAlgorithmOid(await der(name))).toBe(oid);
  });

  it('decodes an OID whose first arc is 2', () => {
    // SEQUENCE { SEQUENCE {}, SEQUENCE { OID 2.5.4.3 } }
    const data = Buffer.from(
      '3009 3000 3005 0603 550403'.replaceAll(' ', ''),
      'hex',
    );
    expect(signatureAlgorithmOid(data)).toBe('2.5.4.3');
  });

  it('rejects data that is not a certificate', () => {
    expect(() => signatureAlgorithmOid(Buffer.from('0400', 'hex'))).toThrow(
      'Not a DER certificate',
    );
  });

  it('rejects truncated data', () => {
    expect(() =>
      signatureAlgorithmOid(
        Buffer.from('3010 3000'.replaceAll(' ', ''), 'hex'),
      ),
    ).toThrow('Truncated');
    expect(() => signatureAlgorithmOid(Buffer.alloc(0))).toThrow('Truncated');
  });

  it('rejects a certificate without an algorithm sequence', () => {
    const data = Buffer.from('3004 3000 0400'.replaceAll(' ', ''), 'hex');
    expect(() => signatureAlgorithmOid(data)).toThrow('No signatureAlgorithm');
  });

  it('rejects an algorithm without an identifier', () => {
    const data = Buffer.from('3006 3000 3002 0400'.replaceAll(' ', ''), 'hex');
    expect(() => signatureAlgorithmOid(data)).toThrow(
      'No algorithm identifier',
    );
  });
});
