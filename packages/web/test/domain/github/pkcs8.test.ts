import { createPrivateKey, generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from '@jest/globals';

import { toPkcs8 } from '@/domain/github/pkcs8';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pkcs1 = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

describe('toPkcs8', () => {
  it('wraps a PKCS#1 key the way the platform does', () => {
    const out = toPkcs8(pkcs1);
    expect(out).toContain('BEGIN PRIVATE KEY');
    expect(
      createPrivateKey(out).export({ type: 'pkcs8', format: 'pem' }).toString(),
    ).toBe(pkcs8);
  });

  it('returns a PKCS#8 key as it came', () => {
    expect(toPkcs8(pkcs8)).toBe(pkcs8);
  });

  it('restores newlines written as \\n or &', () => {
    expect(toPkcs8(pkcs1.trim().replaceAll('\n', '\\n'))).toBe(toPkcs8(pkcs1));
    expect(toPkcs8(pkcs1.trim().replaceAll('\n', '&'))).toBe(toPkcs8(pkcs1));
  });
});
