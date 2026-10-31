import { describe, expect, it } from '@jest/globals';

import {
  createHash,
  createPublicKey,
  X509Certificate,
} from '../../src/browser/crypto.js';
import { takeRefusals } from '../../src/browser/refusals.js';

describe('the browser crypto', () => {
  it.each([
    ['parse a certificate', () => new X509Certificate()],
    ['hash', () => createHash()],
    ['parse a key', () => createPublicKey()],
  ])('refuses to %s, noting crypto', (_label, work) => {
    takeRefusals();
    expect(work).toThrow(/A browser cannot/);
    expect([...takeRefusals()]).toEqual(['crypto']);
  });
});
