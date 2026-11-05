import { describe, expect, it } from '@jest/globals';

import {
  MAX_CIPHERS,
  bodyOf,
  ProbeError,
  parseProbeRequest,
  runProbe,
  type ProbeNamespace,
} from '@/domain/scan/probe';

const parse = (body: Record<string, unknown>) =>
  parseProbeRequest(body, 'example.com');

describe('parseProbeRequest', () => {
  it('takes an HTTPS probe of the scanned host', () => {
    expect(
      parse({
        host: 'Example.com',
        port: 443,
        min_version: 'TLSv1.2',
        max_version: 'TLSv1.3',
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:@SECLEVEL=0',
        sigalgs: 'RSA+SHA256',
        ecdh_curve: 'prime256v1:X25519',
        request_ocsp: true,
      }),
    ).toEqual({
      ok: true,
      value: {
        host: 'Example.com',
        port: 443,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:@SECLEVEL=0',
        sigalgs: 'RSA+SHA256',
        ecdhCurve: 'prime256v1:X25519',
        requestOCSP: true,
      },
    });
  });

  it('takes a STARTTLS probe of any public mail host on port 25', () => {
    expect(
      parse({ host: 'mx.other.example.org', port: 25, starttls: 'smtp' }),
    ).toMatchObject({ ok: true, value: { starttls: 'smtp', port: 25 } });
  });

  it('refuses a field it does not know', () => {
    expect(parse({ host: 'example.com', port: 443, extra: 1 })).toEqual({
      ok: false,
      errors: ['extra: is not a field of a probe'],
    });
  });

  it('refuses an HTTPS probe of a host that is not the one scanned', () => {
    expect(parse({ host: 'other.example.org', port: 443 })).toMatchObject({
      ok: false,
      errors: [expect.stringContaining('only be probed on the host')],
    });
  });

  it.each([
    [{ host: 'example.com', port: 22 }, 'port'],
    [{ host: 'example.com', port: '443' }, 'port'],
    [{ host: 'example.com', port: 443, starttls: 'smtp' }, 'starttls'],
    [{ host: 'example.com', port: 25, starttls: 'imap' }, 'starttls'],
    [{ host: '127.0.0.1', port: 443 }, 'host'],
    [{ host: 'localhost', port: 443 }, 'host'],
    [{ host: 'example.com', port: 443, min_version: 'SSLv3' }, 'min_version'],
    [{ host: 'example.com', port: 443, max_version: 5 }, 'max_version'],
    [
      { host: 'example.com', port: 443, ciphers: ['ok-name', '!aNULL'] },
      'ciphers',
    ],
    [
      {
        host: 'example.com',
        port: 443,
        ciphers: Array.from({ length: MAX_CIPHERS + 1 }, () => 'AES128-SHA'),
      },
      'ciphers',
    ],
    [{ host: 'example.com', port: 443, request_ocsp: 'yes' }, 'request_ocsp'],
    [{ port: 443 }, 'host'],
  ])('refuses %j naming %s', (body, field) => {
    const result = parse(body as Record<string, unknown>);
    expect(result.ok).toBe(false);
    expect(
      (result as { errors: string[] }).errors.some((e) => e.startsWith(field)),
    ).toBe(true);
  });
});

/** A namespace whose one object answers with `answer`, recording the requests. */
function namespace(
  answer: () => Response,
  seen: Request[] = [],
): ProbeNamespace {
  return {
    idFromName: (name) => name,
    get: () => ({
      fetch: async (request) => {
        seen.push(request.clone() as unknown as Request);
        return answer();
      },
    }),
  };
}

describe('bodyOf', () => {
  it('writes one key=value line for each thing asked, and only those', () => {
    expect(
      bodyOf({
        host: 'example.com',
        port: 443,
        minVersion: 'TLSv1.2',
        ciphers: 'AES128-SHA',
        ecdhCurve: 'X25519',
        requestOCSP: true,
      }),
    ).toBe(
      'host=example.com\nport=443\nmin=TLSv1.2\nciphers=AES128-SHA\ncurves=X25519\nocsp=1',
    );
  });

  it('says STARTTLS and leaves OCSP out when not asked', () => {
    expect(
      bodyOf({
        host: 'mx.example.org',
        port: 25,
        starttls: 'smtp',
        requestOCSP: false,
      }),
    ).toBe('host=mx.example.org\nport=25\nstarttls=smtp');
  });
});

describe('runProbe', () => {
  it('posts the probe to the container and returns its answer', async () => {
    const seen: Request[] = [];
    const answer = await runProbe(
      namespace(() => Response.json({ protocol: 'TLSv1.3' }), seen),
      { host: 'example.com', port: 443 },
    );
    expect(await answer.json()).toEqual({ protocol: 'TLSv1.3' });
    expect(new URL(seen[0]!.url).pathname).toBe('/handshake');
    expect(await seen[0]!.text()).toBe('host=example.com\nport=443');
  });

  it('reports a failed handshake with the container’s words', async () => {
    const failing = namespace(() =>
      Response.json({ error: 'dial tcp: i/o timeout' }, { status: 502 }),
    );
    await expect(
      runProbe(failing, { host: 'example.com', port: 443 }),
    ).rejects.toMatchObject({ status: 502, message: 'dial tcp: i/o timeout' });
  });

  it('says probes are not available when there is no container or it is down', async () => {
    await expect(
      runProbe(undefined, { host: 'example.com', port: 443 }),
    ).rejects.toBeInstanceOf(ProbeError);
    await expect(
      runProbe(
        namespace(() => new Response('', { status: 503 })),
        { host: 'example.com', port: 443 },
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
});
