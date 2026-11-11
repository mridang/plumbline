import { describe, expect, it } from '@jest/globals';
import {
  X509Certificate as nodeX509Certificate,
  createHash as nodeCreateHash,
  createPublicKey as nodeCreatePublicKey,
} from 'node:crypto';

import {
  X509Certificate,
  createHash,
  createPublicKey,
} from '../../src/node/crypto.js';

describe('#crypto under Node', () => {
  it('is Node own createHash', () => {
    expect(createHash).toBeDefined();
    expect(createHash).toBe(nodeCreateHash);
  });

  it('is Node own X509Certificate', () => {
    expect(X509Certificate).toBeDefined();
    expect(X509Certificate).toBe(nodeX509Certificate);
  });

  it('is Node own createPublicKey', () => {
    expect(createPublicKey).toBeDefined();
    expect(createPublicKey).toBe(nodeCreatePublicKey);
  });
});
