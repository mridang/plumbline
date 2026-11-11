import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';

import { describe, expect, it } from '@jest/globals';
import { dns } from '@mridang/webhint-hint-plumbline/dist/core/dns.js';
import { rpki } from '@mridang/webhint-hint-plumbline/dist/core/rpki.js';
import { mailNet } from '@mridang/webhint-hint-plumbline/dist/lib/email/net.js';
import { compression } from '@mridang/webhint-hint-plumbline/dist/lib/network/compression.js';
import { tls as dane } from '@mridang/webhint-hint-plumbline/dist/lib/network/dane.js';
import { network } from '@mridang/webhint-hint-plumbline/dist/lib/network/ipv6.js';
import { tlsProbe } from '@mridang/webhint-hint-plumbline/dist/lib/tls/client.js';
import { openssl } from '@mridang/webhint-hint-plumbline/dist/lib/tls/openssl.js';

import { ensureRoots, withProbe } from '../../../src/engine/probe/install.js';
import { toBase64 } from '../../../src/engine/probe/protocol.js';
import {
  fakeProbe,
  handshakeAnswer,
  httpAnswer,
  linesOf,
  ok,
} from '../../helpers/probe.js';
import { vector } from '../../helpers/data.js';

/** A probe that answers each path with `answers[path]`, and keeps what it was sent. */
function probeFor(
  answers: Record<string, (body: string) => string>,
): ReturnType<typeof fakeProbe> {
  return fakeProbe((path, body) => {
    const answer = answers[path];
    return answer
      ? ok(answer(body))
      : { status: 502, text: `{"error":"no ${path}"}` };
  });
}

/** What reaches the resolver behind the scan's cache (the cache is put in front of it by the first scan). */
const asked: string[] = [];
let flaky = true;
dns.client = {
  query: async (name, type) => {
    asked.push(`${type} ${name}`);
    if (name === 'flaky.test' && flaky) {
      flaky = false;
      throw new Error('timed out');
    }
    return { status: 0, authenticated: false, answers: [], authority: [] };
  },
};

/** What reaches the route validator behind the scan's cache. */
const looked: string[] = [];
rpki.client = {
  check: async (ip) => {
    looked.push(ip);
    if (
      ip === '192.0.2.99' &&
      looked.filter((seen) => seen === ip).length === 1
    ) {
      throw new Error('down');
    }
    return { asn: 64_500, prefix: '192.0.2.0/24', status: 'valid' };
  },
};

describe('the TLS handshake', () => {
  it('asks the probe, with the versions, ciphers, groups and OCSP the check wanted, and returns what Node would', async () => {
    const { client, sent } = probeFor({
      '/v1/handshakes': (body) =>
        JSON.stringify({
          results: body
            .split('--\n')
            .map(() =>
              handshakeAnswer('TLSv1.2', 'ECDHE-RSA-AES128-GCM-SHA256'),
            ),
        }),
    });
    const result = await withProbe(client, () =>
      tlsProbe.connect(
        { host: 'example.com', port: 443 },
        {
          minVersion: 'TLSv1.2',
          maxVersion: 'TLSv1.2',
          ciphers: 'AES128',
          ecdhCurve: 'X25519',
          sigalgs: 'RSA+SHA1',
          requestOCSP: true,
        },
      ),
    );
    expect(result.protocol).toBe('TLSv1.2');
    expect(result.peerCertificate.infoAccess?.['OCSP - URI']).toEqual([
      'https://ocsp.example.com',
    ]);
    expect(linesOf(sent[0]?.body ?? '')).toMatchObject({
      host: 'example.com',
      port: '443',
      min: 'TLSv1.2',
      max: 'TLSv1.2',
      ciphers: 'AES128',
      curves: 'X25519',
      sigalgs: 'RSA+SHA1',
      ocsp: '1',
    });
  });

  it('makes an identical handshake once within a scan, however many checks ask, and again in the next scan', async () => {
    const { client, sent } = probeFor({
      '/v1/handshakes': (body) =>
        JSON.stringify({
          results: body.split('--\n').map(() => handshakeAnswer()),
        }),
    });
    const ask = (ciphers: string) =>
      tlsProbe.connect({ host: 'same.test', port: 443 }, { ciphers });
    const [a, b, c] = await withProbe(client, () =>
      Promise.all([ask('AES128'), ask('AES128'), ask('AES256')]),
    );
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(sent.flatMap((request) => request.body.split('--\n'))).toHaveLength(
      2,
    );
    await withProbe(client, () => ask('AES128'));
    expect(sent.flatMap((request) => request.body.split('--\n'))).toHaveLength(
      3,
    );
  });

  it('keeps the answer of a server that would not complete a handshake, but not a handshake the probe could not make', async () => {
    let calls = 0;
    const refusing = probeFor({
      '/v1/handshakes': () => {
        calls += 1;
        return JSON.stringify({
          results: [{ error: 'handshake failed: no cipher' }],
        });
      },
    });
    await withProbe(refusing.client, async () => {
      await expect(
        tlsProbe.connect({ host: 'refuses.test', port: 443 }, {}),
      ).rejects.toThrow('no cipher');
      await expect(
        tlsProbe.connect({ host: 'refuses.test', port: 443 }, {}),
      ).rejects.toThrow('no cipher');
    });
    expect(calls).toBe(1);

    let tries = 0;
    const flaky = fakeProbe(() => {
      tries += 1;
      return tries === 1
        ? { status: 500, text: '' }
        : ok(JSON.stringify({ results: [handshakeAnswer()] }));
    });
    await withProbe(flaky.client, async () => {
      await expect(
        tlsProbe.connect({ host: 'down.test', port: 443 }, {}),
      ).rejects.toThrow('answered 500');
      await expect(
        tlsProbe.connect({ host: 'down.test', port: 443 }, {}),
      ).resolves.toMatchObject({ protocol: 'TLSv1.3' });
    });
  });

  it('fails the handshake the way a refused connection fails, so the check says it could not test', async () => {
    const { client } = probeFor({
      '/v1/handshakes': () =>
        JSON.stringify({ results: [{ error: 'handshake failed: no answer' }] }),
    });
    await expect(
      withProbe(client, () =>
        tlsProbe.connect({ host: 'example.com', port: 443 }, {}),
      ),
    ).rejects.toThrow('handshake failed');
  });
});

describe('the connections of the mail and IPv6 checks', () => {
  it('asks the probe whether an address answers, with the time the check will wait', async () => {
    const { client, sent } = probeFor({
      '/v1/connect': () => '{"reachable":true}',
    });
    await expect(
      withProbe(client, () =>
        network.connect(vector('ip2606_4700__1'), 53, 4000),
      ),
    ).resolves.toBe(true);
    await expect(
      withProbe(client, () =>
        mailNet.client.tcpReachable(vector('ip1_2_3_4'), 25),
      ),
    ).resolves.toBe(true);
    expect(linesOf(sent[0]?.body ?? '')).toMatchObject({
      host: vector('ip2606_4700__1'),
      port: '53',
      timeout: '4000',
    });
  });

  it('counts an address the probe will not connect to, or cannot be asked about, as not answering', async () => {
    const refused = probeFor({});
    await expect(
      withProbe(refused.client, () =>
        network.connect(vector('ip10_0_0_1'), 80, 4000),
      ),
    ).resolves.toBe(false);
  });

  it('reads the STARTTLS dialog of a mail server, and turns a probe that is down into a probe that failed', async () => {
    const { client } = probeFor({
      '/v1/starttls': () =>
        JSON.stringify({
          reachable: true,
          starttls: true,
          tlsVersion: 'TLSv1.3',
          trusted: true,
          trustError: null,
          hostnameMatches: true,
          certificates: [toBase64('der')],
          error: null,
        }),
    });
    const probe = await withProbe(client, () =>
      mailNet.client.probeStarttls('mx.example.com'),
    );
    expect(probe).toMatchObject({
      starttls: true,
      tlsVersion: 'TLSv1.3',
      trusted: true,
    });
    expect(probe.certificates[0]?.toString()).toBe('der');
    const down = probeFor({});
    const failed = await withProbe(down.client, () =>
      mailNet.client.probeStarttls('mx.example.com'),
    );
    expect(failed).toMatchObject({ reachable: false, starttls: false });
    expect(failed.error).toContain('no /v1/starttls');
  });

  it('gets a page by address with the name as Host, without decoding chunks it was not asked to', async () => {
    const { client, sent } = probeFor({
      '/v1/http': () =>
        httpAnswer(200, [['Content-Type', 'text/html']], 'hello'),
    });
    const web = await withProbe(client, () =>
      network.get('example.com', vector('ip2606_4700__1'), 443, true),
    );
    expect(web).toEqual({ status: 200, body: 'hello' });
    expect(linesOf(sent[0]?.body ?? '')).toMatchObject({
      host: 'example.com',
      ip: vector('ip2606_4700__1'),
      port: '443',
      tls: '1',
    });
    const none = await withProbe(probeFor({}).client, () =>
      network.get('example.com', '::1', 443, true),
    );
    expect(none).toBeNull();
  });
});

describe('the other checks', () => {
  it('reads the Content-Encoding of a page without its body', async () => {
    const { client, sent } = probeFor({
      '/v1/http': () =>
        httpAnswer(200, [
          ['Content-Encoding', 'br'],
          ['Content-Encoding', 'gzip'],
        ]),
    });
    const encoding = await withProbe(client, () =>
      compression.probe(new URL('https://example.com/a?b=1')),
    );
    expect(encoding).toBe('br, gzip');
    expect(sent[0]?.body).toContain('nobody=1');
    expect(sent[0]?.body).toContain(
      'header=accept-encoding: br, compress, deflate',
    );
    const down = await withProbe(probeFor({}).client, () =>
      compression.probe(new URL('https://example.com/')),
    );
    expect(down).toBeNull();
  });

  it('presents the chain a server sent for DANE, with whether it validates', async () => {
    const { client } = probeFor({
      '/v1/handshakes': () =>
        JSON.stringify({
          results: [
            {
              ...handshakeAnswer(),
              chain: [toBase64('leaf'), toBase64('root')],
              authorized: false,
            },
          ],
        }),
    });
    const chain = await withProbe(client, () =>
      dane.fetchChain('mx.example.com', 25),
    );
    expect(chain?.chain.map((der) => der.toString())).toEqual(['leaf', 'root']);
    expect(chain?.pkixValid).toBe(false);
    expect(
      await withProbe(probeFor({}).client, () =>
        dane.fetchChain('mx.example.com', 25),
      ),
    ).toBeNull();
  });

  it('runs openssl s_client on the probe, with the arguments the check built and the early data it wrote', async () => {
    const { client, sent } = probeFor({
      '/v1/openssl': () =>
        JSON.stringify({
          stdout: toBase64('Extended master secret: yes'),
          stderr: toBase64(''),
          code: 0,
          files: {},
        }),
    });
    const run = await withProbe(client, () =>
      openssl.exec(
        [
          's_client',
          '-connect',
          '[2606:4700::1]:25',
          '-servername',
          'mx.example.com',
          '-starttls',
          'smtp',
          '-tls1_2',
          '-sess_out',
          'webhint-0rtt-ab/session.pem',
        ],
        { input: ['', 'Q\n'], inputDelayMs: 500, timeoutMs: 20_000 },
      ),
    );
    expect(run).toEqual({
      stdout: 'Extended master secret: yes',
      stderr: '',
      code: 0,
    });
    const body = sent[0]?.body ?? '';
    expect(linesOf(body)).toMatchObject({
      host: vector('ip2606_4700__1'),
      port: '25',
      servername: 'mx.example.com',
      starttls: 'smtp',
      flag: '-tls1_2',
      delay: '500',
      timeout: '20000',
    });
    expect(linesOf(body)['sess_out']).toMatch(/^\w+$/);
  });
});

describe('DNS answers', () => {
  it('asks the resolver once for a name and type within a scan, not again for the same one, and again in the next scan', async () => {
    const { client } = probeFor({});
    const first = await withProbe(client, async () => {
      const [a, b, c] = await Promise.all([
        dns.client.query('Example.com', 'A'),
        dns.client.query('example.com', 'A'),
        dns.client.query('example.com', 'MX'),
      ]);
      return { same: a === b, other: a === c };
    });
    expect(first).toEqual({ same: true, other: false });
    expect(asked).toEqual(['A Example.com', 'MX example.com']);
    await withProbe(client, () => dns.client.query('example.com', 'A'));
    expect(asked).toEqual(['A Example.com', 'MX example.com', 'A example.com']);
  });

  it('does not keep an answer that failed, so the next check can try again', async () => {
    const { client } = probeFor({});
    await withProbe(client, async () => {
      await expect(dns.client.query('flaky.test', 'A')).rejects.toThrow(
        'timed out',
      );
      await expect(dns.client.query('flaky.test', 'A')).resolves.toMatchObject({
        status: 0,
      });
    });
  });

  it('asks the resolver directly outside a scan', async () => {
    await dns.client.query('outside.test', 'A');
    expect(asked).toContain('A outside.test');
  });
});

describe('route validation', () => {
  it('looks an address up once within a scan, however many checks ask, and again in the next scan', async () => {
    const { client } = probeFor({});
    const [a, b] = await withProbe(client, () =>
      Promise.all([
        rpki.client.check('192.0.2.1'),
        rpki.client.check('192.0.2.1'),
      ]),
    );
    expect(a).toBe(b);
    expect(looked.filter((ip) => ip === '192.0.2.1')).toHaveLength(1);
    await withProbe(client, () => rpki.client.check('192.0.2.1'));
    expect(looked.filter((ip) => ip === '192.0.2.1')).toHaveLength(2);
  });

  it('does not keep a lookup that failed', async () => {
    const { client } = probeFor({});
    await withProbe(client, async () => {
      await expect(rpki.client.check('192.0.2.99')).rejects.toThrow('down');
      await expect(rpki.client.check('192.0.2.99')).resolves.toMatchObject({
        status: 'valid',
      });
    });
  });
});

describe('outside a scan', () => {
  it('leaves the original clients alone, so a TCP connection test still opens a socket', async () => {
    await withProbe(probeFor({}).client, async () => undefined);
    const server = createServer().listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      await expect(network.connect('127.0.0.1', port, 1000)).resolves.toBe(
        true,
      );
    } finally {
      server.close();
    }
  });
});

describe('ensureRoots', () => {
  it('leaves the roots alone when the runtime has them', async () => {
    const { client, sent } = probeFor({});
    await ensureRoots(client);
    expect(sent).toHaveLength(0);
  });
});
