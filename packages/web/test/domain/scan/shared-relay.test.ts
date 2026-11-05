import { describe, expect, it, jest } from '@jest/globals';

import type { Relay, Relayed } from '@/domain/scan/relay';
import { keyOf, sharedRelay } from '@/domain/scan/shared-relay';

const answer: Relayed = {
  status: 200,
  url: 'https://a.test/',
  headers: [],
  body: new Uint8Array(),
};
const get = (url: string, headers: Record<string, string> = {}) => ({
  url,
  method: 'GET' as const,
  headers,
});

describe('keyOf', () => {
  it('ignores the order and case of header names', () => {
    expect(keyOf(get('https://a.test/', { A: '1', b: '2' }))).toBe(
      keyOf(get('https://a.test/', { B: '2', a: '1' })),
    );
  });

  it('tells methods, addresses and headers apart', () => {
    const base = keyOf(get('https://a.test/'));
    expect(keyOf({ ...get('https://a.test/'), method: 'HEAD' })).not.toBe(base);
    expect(keyOf(get('https://a.test/x'))).not.toBe(base);
    expect(keyOf(get('https://a.test/', { accept: 'x' }))).not.toBe(base);
  });
});

describe('sharedRelay', () => {
  it('asks once for requests made together and for those made later', async () => {
    const relay = jest.fn<Relay>(async () => answer);
    const shared = sharedRelay(relay);
    await Promise.all([
      shared(get('https://a.test/')),
      shared(get('https://a.test/')),
    ]);
    await shared(get('https://a.test/'));
    expect(relay).toHaveBeenCalledTimes(1);
  });

  it('asks again for a different request', async () => {
    const relay = jest.fn<Relay>(async () => answer);
    const shared = sharedRelay(relay);
    await shared(get('https://a.test/'));
    await shared(get('https://a.test/robots.txt'));
    expect(relay).toHaveBeenCalledTimes(2);
  });

  it('forgets a failure at once, so asking again is a new request', async () => {
    const relay = jest
      .fn<Relay>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(answer);
    const shared = sharedRelay(relay);
    await expect(shared(get('https://a.test/'))).rejects.toThrow('down');
    await expect(shared(get('https://a.test/'))).resolves.toBe(answer);
    expect(relay).toHaveBeenCalledTimes(2);
  });
});
