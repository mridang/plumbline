import { describe, expect, it } from '@jest/globals';
import * as node from 'node:crypto';

import * as ours from '../../src/node/crypto.js';

describe('#crypto under Node', () => {
  it.each(['createHash', 'X509Certificate', 'createPublicKey'] as const)(
    'is Node own %s',
    (name) => {
      expect(ours[name]).toBeDefined();
      expect(ours[name]).toBe(node[name]);
    },
  );
});
