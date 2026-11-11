import { describe, expect, it } from '@jest/globals';
import {
  checkServerIdentity as nodeCheckServerIdentity,
  connect as nodeConnect,
  rootCertificates as nodeRootCertificates,
} from 'node:tls';

import {
  checkServerIdentity,
  connect,
  rootCertificates,
} from '../../src/node/tls.js';

describe('#tls under Node', () => {
  it('is Node own connect', () => {
    expect(connect).toBeDefined();
    expect(connect).toBe(nodeConnect);
  });

  it('is Node own checkServerIdentity', () => {
    expect(checkServerIdentity).toBeDefined();
    expect(checkServerIdentity).toBe(nodeCheckServerIdentity);
  });

  it('is Node own rootCertificates', () => {
    expect(rootCertificates).toBeDefined();
    expect(rootCertificates).toBe(nodeRootCertificates);
  });
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
