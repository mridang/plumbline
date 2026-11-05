import { describe, expect, it } from '@jest/globals';

import {
  ProbeFailure,
  probeFor,
  refusingWhenUnavailable,
} from '@/domain/scan/probe-client';

describe('probeFor', () => {
  it('posts the probe to the scan’s probes and reads the answer', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const call = probeFor('scan id', (async (
      input: unknown,
      init?: RequestInit,
    ) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return Response.json({ protocol: 'TLSv1.2' });
    }) as typeof fetch);
    const answer = await call({ host: 'example.com', port: 443 });
    expect(answer).toEqual({ protocol: 'TLSv1.2' });
    expect(calls).toEqual([
      {
        url: '/api/scans/scan%20id/probes',
        body: { host: 'example.com', port: 443 },
      },
    ]);
  });

  it('fails with the status and the Worker’s words when the Worker refuses', async () => {
    const call = probeFor('s', (async () =>
      Response.json(
        {
          type: '/problems/handshake-failed',
          title: 'Handshake failed',
          detail: 'timeout',
          status: 502,
        },
        {
          status: 502,
          headers: { 'content-type': 'application/problem+json' },
        },
      )) as typeof fetch);
    await expect(
      call({ host: 'example.com', port: 443 }),
    ).rejects.toMatchObject({
      name: 'ProbeFailure',
      status: 502,
    });
    await expect(
      call({ host: 'example.com', port: 443 }),
    ).rejects.toBeInstanceOf(ProbeFailure);
  });
});

describe('refusingWhenUnavailable', () => {
  const refuse = (what: string): never => {
    throw new Error(`refused: ${what}`);
  };
  const request = { host: 'example.com', port: 443 };

  it('passes an answer through', async () => {
    const call = refusingWhenUnavailable(
      async () => ({ protocol: 'TLSv1.3' }) as never,
      refuse,
    );
    expect(await call(request)).toEqual({ protocol: 'TLSv1.3' });
  });

  it('lets a handshake the server refused reject as it is, which is an answer', async () => {
    const failure = new ProbeFailure(502, 'handshake failed');
    const call = refusingWhenUnavailable(async () => {
      throw failure;
    }, refuse);
    await expect(call(request)).rejects.toBe(failure);
  });

  it.each([503, 429, 404])(
    'shows the check as not run when the prober answers %i',
    async (status) => {
      const call = refusingWhenUnavailable(async () => {
        throw new ProbeFailure(status, 'no');
      }, refuse);
      await expect(call(request)).rejects.toThrow(
        'refused: reach the TLS prober',
      );
    },
  );

  it('lets any other failure reject as it is', async () => {
    const failure = new Error('offline');
    const call = refusingWhenUnavailable(async () => {
      throw failure;
    }, refuse);
    await expect(call(request)).rejects.toBe(failure);
  });
});
