import { describe, expect, it } from '@jest/globals';

import { ProbeClient } from '../../../src/engine/probe/client.js';
import { ProbeError, toBase64 } from '../../../src/engine/probe/protocol.js';
import {
  fakeProbe,
  handshakeAnswer,
  httpAnswer,
  linesOf,
  ok,
} from '../../helpers/probe.js';

const batchOf = (count: number): string =>
  JSON.stringify({
    results: Array.from({ length: count }, () => handshakeAnswer()),
  });

describe('handshake', () => {
  it('sends the handshakes asked for together as one batch and answers each', async () => {
    const { client, sent } = fakeProbe((path, body) =>
      ok(batchOf(body.split('--\n').length)),
    );
    const [a, b, c] = await Promise.all([
      client.handshake({ host: 'a.test', port: 443 }),
      client.handshake({
        host: 'b.test',
        port: 443,
        min: 'TLSv1.2',
        ciphers: 'AES128-SHA',
      }),
      client.handshake({
        host: 'c.test',
        port: 25,
        starttls: 'smtp',
        ocsp: true,
      }),
    ]);
    expect([a, b, c].every((answer) => answer.protocol === 'TLSv1.3')).toBe(
      true,
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.path).toBe('/v1/handshakes');
    const items = sent[0]?.body.split('--\n').map(linesOf) ?? [];
    expect(items.map((item) => item['host'])).toEqual([
      'a.test',
      'b.test',
      'c.test',
    ]);
    expect(items[1]).toMatchObject({ min: 'TLSv1.2', ciphers: 'AES128-SHA' });
    expect(items[2]).toMatchObject({ starttls: 'smtp', ocsp: '1' });
  });

  it('sends a full batch at once and the rest in the next', async () => {
    const small = fakeProbe((_path, body) =>
      ok(batchOf(body.split('--\n').length)),
    );
    const client = new ProbeClient(small.transport, { size: 2, waitMs: 1 });
    await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        client.handshake({ host: `${n}.test`, port: 443 }),
      ),
    );
    expect(
      small.sent.map((request) => request.body.split('--\n').length),
    ).toEqual([2, 2, 1]);
  });

  it('rejects the handshake the probe would not make and answers the others', async () => {
    const { client } = fakeProbe(() =>
      ok(
        JSON.stringify({
          results: [
            handshakeAnswer(),
            { error: 'handshake failed: tlsv1 alert protocol version' },
          ],
        }),
      ),
    );
    const [good, bad] = await Promise.allSettled([
      client.handshake({ host: 'a.test', port: 443 }),
      client.handshake({ host: 'b.test', port: 443 }),
    ]);
    expect(good.status).toBe('fulfilled');
    expect(bad).toMatchObject({ status: 'rejected' });
    expect((bad as PromiseRejectedResult).reason).toBeInstanceOf(ProbeError);
  });

  it('rejects every handshake of a batch the probe did not answer in full', async () => {
    const { client } = fakeProbe(() => ok(batchOf(1)));
    const results = await Promise.allSettled([
      client.handshake({ host: 'a.test', port: 443 }),
      client.handshake({ host: 'b.test', port: 443 }),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect((results[0] as PromiseRejectedResult).reason.message).toContain(
      'answered 1 handshakes for 2',
    );
  });

  it('rejects when the probe cannot be reached, answers 500, or says something that is not JSON', async () => {
    const unreachable = new ProbeClient(
      () => Promise.reject(new Error('Network connection lost')),
      { waitMs: 1 },
    );
    await expect(
      unreachable.handshake({ host: 'a.test', port: 443 }),
    ).rejects.toThrow(
      'the probe could not be reached: Network connection lost',
    );
    const broken = fakeProbe(() => ({ status: 500, text: 'oops' }));
    await expect(
      broken.client.handshake({ host: 'a.test', port: 443 }),
    ).rejects.toThrow('answered 500');
    const html = fakeProbe(() => ok('<html>'));
    await expect(
      html.client.handshake({ host: 'a.test', port: 443 }),
    ).rejects.toThrow('not JSON');
  });

  it('asks for one handshake on its own when it is told to', async () => {
    const { client, sent } = fakeProbe(() =>
      ok(JSON.stringify(handshakeAnswer())),
    );
    await expect(
      client.handshakeNow({ host: 'a.test', port: 443 }),
    ).resolves.toMatchObject({ protocol: 'TLSv1.3' });
    expect(sent[0]?.path).toBe('/handshake');
  });
});

describe('busy probe', () => {
  it('sends a request again when the probe says it is busy, and gives up after the retries', async () => {
    let calls = 0;
    const { transport } = fakeProbe(() => {
      calls += 1;
      return calls < 3 ? { status: 503, text: '' } : ok('{"reachable":true}');
    });
    await expect(
      new ProbeClient(transport, { retries: 5 }).reachable('1.1.1.1', 53),
    ).resolves.toBe(true);
    expect(calls).toBe(3);

    const busy = fakeProbe(() => ({ status: 503, text: '' }));
    await expect(
      new ProbeClient(busy.transport, { retries: 1 }).reachable('1.1.1.1', 53),
    ).rejects.toThrow('answered 503 (it is busy)');
    expect(busy.sent).toHaveLength(2);
  });

  it('keeps no more requests on their way than it was told to', async () => {
    let running = 0;
    let most = 0;
    const { transport } = fakeProbe(async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return ok('{"reachable":true}');
    });
    const client = new ProbeClient(transport, { inFlight: 3 });
    await Promise.all(
      Array.from({ length: 10 }, (_v, n) =>
        client.reachable('1.1.1.1', 80 + n),
      ),
    );
    expect(most).toBe(3);
  });
});

describe('the other requests', () => {
  it('asks for a connection test with its timeout, and treats a refused address as not reachable', async () => {
    const { client, sent } = fakeProbe((_path, body) =>
      linesOf(body)['host'] === '10.0.0.1'
        ? { status: 502, text: '{"error":"not a public address"}' }
        : ok('{"reachable":true}'),
    );
    await expect(client.reachable('1.1.1.1', 53, 4000)).resolves.toBe(true);
    expect(linesOf(sent[0]?.body ?? '')).toMatchObject({
      host: '1.1.1.1',
      port: '53',
      timeout: '4000',
    });
    await expect(client.reachable('10.0.0.1', 80)).resolves.toBe(false);
  });

  it('lets another complaint through', async () => {
    const { client } = fakeProbe(() => ({
      status: 502,
      text: '{"error":"the connection failed"}',
    }));
    await expect(client.reachable('1.1.1.1', 80)).rejects.toThrow(
      'the connection failed',
    );
  });

  it('asks for an HTTP exchange with every header line, and returns what came', async () => {
    const { client, sent } = fakeProbe(() =>
      ok(httpAnswer(404, [['Content-Type', 'text/plain']], 'no', 'Not Found')),
    );
    const answer = await client.http({
      host: 'example.com',
      port: 443,
      tls: true,
      ip: '2606:4700::1',
      method: 'GET',
      path: '/robots.txt',
      headers: [
        ['accept', '*/*'],
        ['x-a', 'b'],
      ],
      nobody: false,
      maxBody: 1000,
    });
    expect(answer.status).toBe(404);
    expect(answer.statusText).toBe('Not Found');
    const body = sent[0]?.body ?? '';
    expect(body).toContain('header=accept: */*\nheader=x-a: b\n');
    expect(linesOf(body)).toMatchObject({
      host: 'example.com',
      tls: '1',
      ip: '2606:4700::1',
      maxbody: '1000',
    });
    expect(body).not.toContain('nobody');
  });

  it('asks for the STARTTLS dialog and for the trusted roots', async () => {
    const { client, sent } = fakeProbe((path) =>
      path === '/v1/roots'
        ? ok('-----BEGIN CERTIFICATE-----\nAA\n-----END CERTIFICATE-----\n')
        : ok(
            JSON.stringify({
              reachable: true,
              starttls: true,
              tlsVersion: 'TLSv1.2',
              trusted: false,
              trustError: 'CERT_HAS_EXPIRED',
              hostnameMatches: true,
              certificates: [],
              error: null,
            }),
          ),
    );
    await expect(client.starttls('mx.example.com')).resolves.toMatchObject({
      trustError: 'CERT_HAS_EXPIRED',
    });
    expect(sent[0]?.path).toBe('/v1/starttls');
    await expect(client.roots()).resolves.toContain('BEGIN CERTIFICATE');
  });

  it('asks for an openssl run with its flags, lines and session names', async () => {
    const { client, sent } = fakeProbe(() =>
      ok(
        JSON.stringify({
          stdout: toBase64('out'),
          stderr: toBase64(''),
          code: 0,
          files: {},
        }),
      ),
    );
    const answer = await client.openssl({
      host: 'example.com',
      port: 443,
      servername: 'example.com',
      flags: ['-tls1_3'],
      sessionOut: 'abc',
      earlyData: 'GET /',
      input: ['', 'Q\n'],
      delayMs: 500,
      timeoutMs: 20000,
    });
    expect(answer.stdout).toBe('out');
    const body = sent[0]?.body ?? '';
    expect(body).toContain('flag=-tls1_3\n');
    expect(body).toContain(`input=${toBase64('Q\n')}\n`);
    expect(linesOf(body)).toMatchObject({
      sess_out: 'abc',
      early_data: toBase64('GET /'),
      delay: '500',
      timeout: '20000',
    });
  });
});
