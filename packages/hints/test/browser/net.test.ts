import { describe, expect, it } from '@jest/globals';

import { connect, isIP, isIPv4, isIPv6 } from '../../src/browser/net.js';
import { takeRefusals } from '../../src/browser/refusals.js';

describe('isIP', () => {
  it.each([
    ['192.0.2.1', 4],
    ['255.255.255.255', 4],
    ['2001:db8::1', 6],
    ['::1', 6],
    ['fe80::1%eth0', 6],
    ['256.1.1.1', 0],
    ['example.com', 0],
    ['1.2.3', 0],
    ['gggg::1', 0],
    ['', 0],
  ])('calls %s %i, as Node does', (value, kind) => {
    expect(isIP(value)).toBe(kind);
    expect(isIPv4(value)).toBe(kind === 4);
    expect(isIPv6(value)).toBe(kind === 6);
  });
});

describe('connect', () => {
  it('refuses and notes a socket', () => {
    takeRefusals();
    expect(() => connect()).toThrow(
      'A browser cannot open a raw TCP connection.',
    );
    expect([...takeRefusals()]).toEqual(['socket']);
  });
});
