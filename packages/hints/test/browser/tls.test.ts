import { describe, expect, it } from '@jest/globals';

import tls, {
  checkServerIdentity,
  connect,
  rootCertificates,
} from '../../src/browser/tls.js';
import { takeRefusals } from '../../src/browser/refusals.js';

describe('the browser tls', () => {
  it('has no root store', () => {
    expect(rootCertificates).toEqual([]);
  });

  it('refuses to connect or check a certificate, noting a socket', () => {
    takeRefusals();
    expect(() => connect()).toThrow(
      'A browser cannot open a TLS connection it can inspect.',
    );
    expect(() => checkServerIdentity()).toThrow();
    expect([...takeRefusals()]).toEqual(['socket']);
  });

  it('offers the same members as a default export, as Node does', () => {
    expect(tls.connect).toBe(connect);
  });
});
