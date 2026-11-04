import { describe, expect, it } from '@jest/globals';
import * as node from 'node:tls';

import * as ours from '../../src/node/tls.js';

describe('#tls under Node', () => {
  it.each(['connect', 'checkServerIdentity', 'rootCertificates'] as const)(
    'is Node own %s',
    (name) => {
      expect(ours[name]).toBeDefined();
      expect(ours[name]).toBe(node[name]);
    },
  );
});

describe('the default export', () => {
  it('is Node own tls module', async () => {
    const [{ default: theirs }, { default: mine }] = await Promise.all([
      import('node:tls'),
      import('../../src/node/tls.js'),
    ]);
    expect(mine).toBe(theirs);
  });
});
