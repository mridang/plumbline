import { describe, expect, it } from '@jest/globals';

import {
  ALLOWED_PORTS,
  ScanRefusedError,
  assertScannable,
} from '../../src/engine/scannable.js';

describe('assertScannable', () => {
  it('lets an https or http address on the default port or a listed port through', () => {
    for (const address of [
      'https://example.com/',
      'https://example.com/',
      'https://example.com:8443/x',
      'https://example.com:8080/',
    ]) {
      expect(() => assertScannable(new URL(address))).not.toThrow();
    }
    expect([...ALLOWED_PORTS].toSorted((a, b) => a - b)).toEqual(
      [443, 80, 8080, 8443].toSorted((a, b) => a - b),
    );
  });

  it('refuses any other scheme, with the scheme in the message', () => {
    expect(() => assertScannable(new URL('ftp://example.com/'))).toThrow(
      new ScanRefusedError('Only http and https can be fetched, not ftp:'),
    );
    expect(() => assertScannable(new URL('file:///etc/passwd'))).toThrow(
      ScanRefusedError,
    );
  });

  it('refuses a port that is not listed', () => {
    expect(() => assertScannable(new URL('https://example.com:22/'))).toThrow(
      'Port 22 cannot be fetched',
    );
  });

  it('refuses an address that carries a user name or a password', () => {
    expect(() => assertScannable(new URL('https://user@example.com/'))).toThrow(
      'user name or password',
    );
    expect(() =>
      assertScannable(new URL('https://user:secret@example.com/')),
    ).toThrow(ScanRefusedError);
  });
});
