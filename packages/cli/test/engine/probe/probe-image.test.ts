import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { ProbeClient } from '../../../src/engine/probe/client.js';
import { ProbeError } from '../../../src/engine/probe/protocol.js';

/**
 * The real probe: the image is built from `probe/Dockerfile` (which runs the C
 * self-test), started, and asked what it must answer without the internet. It
 * connects to public addresses only, so everything asked of it here is a
 * refusal, a bad request or something it knows by itself (its trusted roots).
 */
jest.setTimeout(900_000);

const IMAGE = 'plumbline-probe:spec';
const NAME = `plumbline-probe-spec-${process.pid}`;
let base = '';

const docker = (...args: string[]): string =>
  execFileSync('docker', args, { encoding: 'utf8' }).trim();

/** A request to the running probe: the status and the text of the answer. */
async function post(
  route: string,
  body: string,
): Promise<{ status: number; text: string }> {
  const answer = await fetch(`${base}${route}`, { method: 'POST', body });
  return { status: answer.status, text: await answer.text() };
}

beforeAll(async () => {
  docker('build', '-t', IMAGE, path.resolve(process.cwd(), 'probe'));
  docker('run', '-d', '--name', NAME, '-P', IMAGE);
  const mapped = docker('port', NAME, '8080/tcp').split('\n', 1)[0] ?? '';
  base = `http://127.0.0.1:${mapped.slice(mapped.lastIndexOf(':') + 1)}`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`${base}/healthz`)).ok) {
        return;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('the probe did not start');
});

afterAll(() => {
  try {
    docker('rm', '-f', NAME);
  } catch {
    // Already gone.
  }
});

describe('the probe image', () => {
  it('is a few megabytes on an empty image', () => {
    const bytes = Number(
      docker('image', 'inspect', IMAGE, '--format', '{{.Size}}'),
    );
    expect(bytes).toBeLessThan(8 * 1024 * 1024);
  });

  it('answers its health check and 404 for a path it does not have', async () => {
    expect(await (await fetch(`${base}/healthz`)).text()).toBe('ok');
    expect((await fetch(`${base}/nowhere`)).status).toBe(404);
    expect((await post('/v1/nowhere', '')).status).toBe(404);
  });

  it('serves its trusted roots as one PEM bundle', async () => {
    const roots = await new ProbeClient((route, body) =>
      post(route, body),
    ).roots();
    expect(roots.match(/BEGIN CERTIFICATE/g)?.length).toBeGreaterThan(100);
  });
});

describe('the probe refuses what it must refuse', () => {
  const client = (): ProbeClient =>
    new ProbeClient((route, body) => post(route, body), { waitMs: 1 });

  it.each([
    ['loopback', '127.0.0.1'],
    ['a private network', '10.0.0.1'],
    ['the cloud metadata address', '169.254.169.254'],
    ['IPv6 loopback', '::1'],
    ['a name that resolves to loopback', 'localhost'],
  ])('does not connect to %s', async (_name, host) => {
    await expect(client().reachable(host, 80)).resolves.toBe(false);
    await expect(
      client().http({
        host,
        port: 80,
        tls: false,
        method: 'GET',
        path: '/',
        headers: [],
      }),
    ).rejects.toThrow('not a public address');
    await expect(client().handshake({ host, port: 443 })).rejects.toThrow(
      'not a public address',
    );
    await expect(client().starttls(host)).resolves.toMatchObject({
      reachable: false,
      error: 'not a public address',
    });
    await expect(
      client().openssl({
        host,
        port: 443,
        flags: [],
        input: ['Q\n'],
        delayMs: 0,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('not a public address');
  });

  it('answers each handshake of a batch on its own, a refused one with its reason', async () => {
    const answers = await Promise.allSettled([
      client().handshake({ host: '127.0.0.1', port: 443 }),
      client().handshake({ host: '10.1.2.3', port: 25, starttls: 'smtp' }),
    ]);
    expect(answers.map((answer) => answer.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    for (const answer of answers) {
      expect((answer as PromiseRejectedResult).reason).toBeInstanceOf(
        ProbeError,
      );
      expect((answer as PromiseRejectedResult).reason.message).toBe(
        'not a public address',
      );
    }
  });

  it.each([
    [
      'a port that is not on the list',
      '/v1/connect',
      'host=1.1.1.1\nport=22\n',
    ],
    [
      'a key it does not know',
      '/v1/connect',
      'host=1.1.1.1\nport=53\nextra=1\n',
    ],
    ['a line without a key', '/v1/connect', 'nonsense\n'],
    ['no host', '/v1/connect', 'port=53\n'],
    [
      'a method with a space',
      '/v1/http',
      'host=example.com\nport=80\nmethod=GET /x\npath=/\n',
    ],
    [
      'a path without a slash',
      '/v1/http',
      'host=example.com\nport=80\nmethod=GET\npath=x\n',
    ],
    [
      'a Host header of its own',
      '/v1/http',
      'host=example.com\nport=80\nmethod=GET\npath=/\nheader=Host: evil\n',
    ],
    [
      'a header with no colon',
      '/v1/http',
      'host=example.com\nport=80\nmethod=GET\npath=/\nheader=nocolon\n',
    ],
    [
      'a flag it does not allow',
      '/v1/openssl',
      'host=example.com\nport=443\nflag=-key\n',
    ],
    [
      'a session name with a slash',
      '/v1/openssl',
      'host=example.com\nport=443\nsess_out=../x\n',
    ],
    [
      'a handshake on a port it does not use',
      '/handshake',
      'host=example.com\nport=22\n',
    ],
  ])('answers 400 for %s', async (_name, route, body) => {
    expect((await post(route, body)).status).toBe(400);
  });

  it('answers 400 for a body shorter than it says', async () => {
    const raw = await fetch(`${base}/v1/connect`, {
      method: 'POST',
      body: 'host=1.1.1.1\nport=53\n',
      headers: { 'content-length': '21' },
    });
    expect(raw.status).toBe(200);
  });
});
