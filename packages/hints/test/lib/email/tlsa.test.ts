import { X509Certificate, createHash } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import {
  isDaneUsage,
  parseTlsa,
  tlsaFieldProblem,
  tlsaMatches,
} from '../../../src/lib/email/tlsa.js';
import { TEST_CERT } from './test-cert.js';

const cert = new X509Certificate(TEST_CERT);
const der = cert.raw;
const spki = cert.publicKey.export({ type: 'spki', format: 'der' });
const sha256 = (data: Buffer): string =>
  createHash('sha256').update(data).digest('hex');

describe('parseTlsa', () => {
  it('parses the presentation format', () => {
    const record = parseTlsa('3 1 1 AB cd');
    expect(record).toEqual({
      usage: 3,
      selector: 1,
      matching: 1,
      data: Buffer.from('abcd', 'hex'),
    });
  });

  it('parses the generic format', () => {
    const record = parseTlsa(String.raw`\# 5 030101ab`);
    expect(record).toBeNull();
    expect(parseTlsa(String.raw`\# 4 030101ab`)).toEqual({
      usage: 3,
      selector: 1,
      matching: 1,
      data: Buffer.from('ab', 'hex'),
    });
  });

  it('rejects malformed records', () => {
    expect(parseTlsa('garbage')).toBeNull();
    expect(parseTlsa('3 1 1 abc')).toBeNull();
    expect(parseTlsa('3 1 1')).toBeNull();
    expect(parseTlsa(String.raw`\# 2 0301`)).toBeNull();
  });
});

describe('tlsaFieldProblem', () => {
  const record = (
    usage: number,
    selector: number,
    matching: number,
    data: Buffer,
  ) => ({
    usage,
    selector,
    matching,
    data,
  });

  it('accepts a well formed record', () => {
    expect(tlsaFieldProblem(record(3, 1, 1, Buffer.alloc(32)))).toBeNull();
    expect(tlsaFieldProblem(record(2, 0, 2, Buffer.alloc(64)))).toBeNull();
    expect(tlsaFieldProblem(record(3, 0, 0, Buffer.alloc(5)))).toBeNull();
  });

  it('rejects unknown fields, wrong digest lengths and empty data', () => {
    expect(tlsaFieldProblem(record(4, 1, 1, Buffer.alloc(32)))).toContain(
      'usage',
    );
    expect(tlsaFieldProblem(record(3, 2, 1, Buffer.alloc(32)))).toContain(
      'selector',
    );
    expect(tlsaFieldProblem(record(3, 1, 3, Buffer.alloc(32)))).toContain(
      'matching',
    );
    expect(tlsaFieldProblem(record(3, 1, 1, Buffer.alloc(31)))).toContain(
      'digest',
    );
    expect(tlsaFieldProblem(record(3, 1, 0, Buffer.alloc(0)))).toContain(
      'empty',
    );
  });
});

describe('isDaneUsage', () => {
  it('accepts usages 2 and 3 only', () => {
    const usage = (n: number) =>
      isDaneUsage({
        usage: n,
        selector: 1,
        matching: 1,
        data: Buffer.alloc(0),
      });
    expect([0, 1, 2, 3].map((n) => usage(n))).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });
});

describe('tlsaMatches', () => {
  it('matches the SPKI digest of the leaf for DANE-EE', () => {
    const record = parseTlsa(`3 1 1 ${sha256(spki)}`)!;
    expect(tlsaMatches(record, [der])).toBe(true);
  });

  it('matches the full certificate digest and exact bytes', () => {
    expect(tlsaMatches(parseTlsa(`3 0 1 ${sha256(der)}`)!, [der])).toBe(true);
    expect(tlsaMatches(parseTlsa(`3 0 0 ${der.toString('hex')}`)!, [der])).toBe(
      true,
    );
    const sha512 = createHash('sha512').update(der).digest('hex');
    expect(tlsaMatches(parseTlsa(`3 0 2 ${sha512}`)!, [der])).toBe(true);
  });

  it('does not match another digest', () => {
    expect(tlsaMatches(parseTlsa(`3 1 1 ${'00'.repeat(32)}`)!, [der])).toBe(
      false,
    );
  });

  it('matches DANE-TA against any certificate of the chain', () => {
    const other = Buffer.from('not a certificate');
    expect(tlsaMatches(parseTlsa(`2 1 1 ${sha256(spki)}`)!, [other, der])).toBe(
      true,
    );
  });

  it('matches DANE-EE against the leaf only', () => {
    const other = Buffer.from('not a certificate');
    expect(tlsaMatches(parseTlsa(`3 1 1 ${sha256(spki)}`)!, [other, der])).toBe(
      false,
    );
  });

  it('never matches PKIX usages or malformed records', () => {
    expect(tlsaMatches(parseTlsa(`1 1 1 ${sha256(spki)}`)!, [der])).toBe(false);
    expect(tlsaMatches(parseTlsa(`0 1 1 ${sha256(spki)}`)!, [der])).toBe(false);
    expect(tlsaMatches(parseTlsa('3 1 1 abcd')!, [der])).toBe(false);
  });
});
