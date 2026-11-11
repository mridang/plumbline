import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { disableRepo } from '@/domain/db/disabled';
import { addDomain } from '@/domain/db/domains';
import { listRuns } from '@/domain/db/runs';
import { latestRuns } from '@/domain/db/suite';
import type { SuiteJob } from '@/domain/suite/scanner';

import { GITHUB_ENV, fakeGitHub } from '../../domain/github/github-test-kit';
import { cloudflareWorkersStub } from '../../helpers/cloudflare-workers-stub';
import { APP_MIGRATIONS } from '../core/db/migrations';
import { sqliteD1 } from '../core/db/sqlite-d1';

jest.unstable_mockModule('cloudflare:workers', cloudflareWorkersStub, {
  virtual: true,
} as never);

const {
  ProbeScanner,
  AFTER_JOB_IDLE_MS,
  IDLE_MS,
  SLOW_PROBE_MS,
  START_TIMEOUT_MS,
  aboutRequest,
} = await import('@/lib/cloudflare/probe-scanner');

/** The answer of the probe's `/v1/http` for a response. */
const httpAnswer = (
  status: number,
  headers: [string, string][],
  body: string,
): string =>
  JSON.stringify({
    httpVersion: 'HTTP/1.1',
    status,
    statusText: 'X',
    headers,
    body: Buffer.from(body).toString('base64'),
    truncated: false,
  });

/** A bare page: it passes few checks, so a scan of it opens an issue. */
const PAGE =
  '<!doctype html><html lang="en"><head><title>Hi</title></head><body>hi</body></html>';

interface ProbeOptions {
  /** How the probe answers a request for the page; the default is the bare page. */
  page?: () => Response;
  /** The probe does not answer, as when its container is gone. */
  down?: boolean;
  running?: boolean;
  /** How many health checks fail before the container answers. */
  failures?: number;
}

/** A probe container for a site with one page; `log` lists what the container was asked, `asked` the pages. */
function probe(options: ProbeOptions = {}) {
  const log: string[] = [];
  const asked: string[] = [];
  let failures = options.failures ?? 0;
  const container = {
    running: options.running ?? true,
    start: (startup: unknown) => {
      log.push(`start ${JSON.stringify(startup)}`);
      container.running = true;
    },
    setInactivityTimeout: async (ms: number | bigint) => {
      log.push(`idle ${ms}`);
    },
    getTcpPort: (port: number) => ({
      fetch: async (input: string, init?: RequestInit) => {
        const path = new URL(input).pathname;
        log.push(`${init?.method ?? 'GET'} ${port} ${path}`);
        if (path === '/healthz') {
          if (failures > 0) {
            failures -= 1;
            throw new Error('not listening');
          }
          return new Response('ok');
        }
        if (options.down) {
          throw new Error('Network connection lost');
        }
        const body = init?.body
          ? await new Response(init.body as BodyInit).text()
          : '';
        switch (path) {
          case '/v1/roots': {
            return new Response(
              '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n',
            );
          }
          case '/v1/http': {
            if (body.includes('path=/\n')) {
              asked.push(/host=(.*)/.exec(body)?.[1] ?? '');
              return (
                options.page?.() ??
                new Response(
                  httpAnswer(
                    200,
                    [
                      ['Content-Type', 'text/html; charset=utf-8'],
                      ['Alt-Svc', 'h3=":443"'],
                    ],
                    PAGE,
                  ),
                )
              );
            }
            return new Response(
              httpAnswer(404, [['Content-Type', 'text/plain']], 'no'),
            );
          }
          case '/v1/handshakes': {
            return Response.json({
              results: body
                .split('--\n')
                .map(() => ({ error: 'handshake failed: no answer' })),
            });
          }
          case '/v1/connect': {
            return new Response('{"reachable":false}');
          }
          default: {
            return new Response('{"error":"not here"}', { status: 502 });
          }
        }
      },
    }),
  };
  return { container, log, asked };
}

const run = (url = 'https://example.com/') =>
  new Request('https://scanner.internal/run', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

/** The lines of a stream, parsed. */
async function lines(
  response: Response,
): Promise<{ type: string; outcome?: { id: string; status: string } }[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as { type: string });
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  // The checks ask a DNS-over-HTTPS resolver for names; the tests never touch the internet.
  globalThis.fetch = (async () =>
    Response.json(
      { Status: 3, Answer: [] },
      {
        headers: { 'content-type': 'application/dns-json' },
      },
    )) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  jest.restoreAllMocks();
});

const made = (container: unknown) =>
  new ProbeScanner({ container } as never, {} as never);

describe('ProbeScanner, a scan', () => {
  it('runs every check in the object and streams them, asking the probe only for the network', async () => {
    const { container, log } = probe();
    const response = await made(container).fetch(run());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(
      'application/x-ndjson',
    );
    const out = await lines(response);
    expect(out[0]).toMatchObject({ type: 'ready' });
    expect(out.at(-1)).toEqual({ type: 'end' });
    const done = out.filter((line) => line.type === 'done');
    expect(done.length).toBeGreaterThan(250);
    expect(
      done.find((line) => line.outcome?.id === 'alt-svc')?.outcome?.status,
    ).toBe('passed');
    // Only the network is asked of the probe: pages and files, handshakes, connection tests.
    expect(
      [...new Set(log.map((line) => line.split(' ', 3)[2]))].toSorted((a, b) =>
        (a ?? '').localeCompare(b ?? ''),
      ),
    ).toEqual(['/healthz', '/v1/connect', '/v1/handshakes', '/v1/http']);
  });

  it('breaks the stream when the probe is down, so whoever reads it knows to try again', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = probe({ down: true });
    const response = await made(container).fetch(run());
    await expect(response.text()).rejects.toThrow(
      'the probe could not be reached',
    );
  });

  it('refuses a scan that has no address', async () => {
    const { container } = probe();
    const response = await made(container).fetch(
      new Request('https://scanner.internal/run', {
        method: 'POST',
        body: '{}',
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe('ProbeScanner, slow probe calls', () => {
  it('says what a request is about: the route and the host, port, address and path it names, never a header', () => {
    expect(
      aboutRequest(
        '/v1/http',
        'host=example.com\nport=443\ntls=1\nip=2606:4700::1\nmethod=GET\npath=/a?b=1\nheader=Cookie: secret\n',
      ),
    ).toBe('/v1/http host=example.com port=443 ip=2606:4700::1 path=/a?b=1');
    expect(
      aboutRequest(
        '/v1/handshakes',
        'host=a.test\nport=25\nstarttls=smtp\n--\nhost=b.test\nport=25\n',
      ),
    ).toBe('/v1/handshakes x2 host=a.test port=25 starttls=smtp');
  });

  it('logs a call that took long, and nothing for the quick ones', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { container } = probe();
    const inner = container.getTcpPort(8080).fetch;
    container.getTcpPort = () => ({
      fetch: async (input: string, init?: RequestInit) => {
        if (new URL(input).pathname === '/v1/connect') {
          await new Promise((resolve) =>
            setTimeout(resolve, SLOW_PROBE_MS + 100),
          );
        }
        return inner(input, init);
      },
    });
    const response = await made(container).fetch(run());
    await response.text();
    const logged = warn.mock.calls.map((call) => String(call[0]));
    expect(logged.length).toBeGreaterThan(0);
    expect(
      logged.every((line) =>
        /^slow probe call \d+ ms: \/v1\/connect /.test(line),
      ),
    ).toBe(true);
  });

  it('logs nothing when every call is quick', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { container } = probe();
    const response = await made(container).fetch(run());
    await response.text();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('ProbeScanner, the container', () => {
  it('starts the container with internet, sets its idle time and asks it', async () => {
    const { container, log } = probe({ running: false });
    const response = await made(container).fetch(run());
    expect(response.status).toBe(200);
    await response.text();
    expect(log.slice(0, 2)).toEqual([
      'start {"enableInternet":true}',
      `idle ${IDLE_MS}`,
    ]);
    expect(log).toContain('POST 8080 /v1/http');
  });

  it('does not start a container that is already running, but renews its idle time', async () => {
    const { container, log } = probe({ running: true });
    const response = await made(container).fetch(run());
    await response.text();
    expect(log.some((line) => line.startsWith('start'))).toBe(false);
    expect(log).toContain(`idle ${IDLE_MS}`);
  });

  it('waits for a starting container to answer', async () => {
    const { container, log } = probe({ failures: 2 });
    const response = await made(container).fetch(
      new Request('https://scanner.internal/healthz'),
    );
    expect(await response.text()).toBe('ok');
    // Two checks fail, the third answers, and the request itself is forwarded after that.
    expect(log.filter((line) => line.endsWith('/healthz'))).toHaveLength(4);
  });

  it('gives up with 503 when the container never answers', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    try {
      const { container } = probe({ failures: Number.MAX_SAFE_INTEGER });
      const pending = made(container).fetch(
        new Request('https://scanner.internal/healthz'),
      );
      await jest.advanceTimersByTimeAsync(START_TIMEOUT_MS + 1000);
      const response = await pending;
      expect(response.status).toBe(503);
    } finally {
      jest.useRealTimers();
    }
  });

  it('answers 503 when no container is bound', async () => {
    const response = await made(undefined).fetch(
      new Request('https://scanner.internal/healthz'),
    );
    expect(response.status).toBe(503);
  });

  it('forwards anything that is not a scan or a job to the container', async () => {
    const { container, log } = probe();
    const response = await made(container).fetch(
      new Request('https://scanner.internal/healthz'),
    );
    expect(await response.text()).toBe('ok');
    expect(log).toContain('GET 8080 /healthz');
  });
});

const JOB: SuiteJob = {
  installationId: 5,
  userId: 7,
  deployed: {
    environment: 'production',
    name: 'production',
    repo: 'acme/site',
    sha: 'abc123',
    url: null,
  },
  appUrl: 'https://plumbline.test',
};

const DEPLOYMENT_JOB = { kind: 'deployment', ...JOB };

const post = (job: unknown = DEPLOYMENT_JOB) =>
  new Request('https://scanner.internal/jobs', {
    method: 'POST',
    body: typeof job === 'string' ? job : JSON.stringify(job),
  });

const RECHECK = {
  kind: 'recheck',
  userId: 7,
  host: 'site.test',
  repo: 'acme/site',
} as const;

describe('ProbeScanner, the job of the queue', () => {
  const setup = async (env: Record<string, unknown> = GITHUB_ENV) => {
    const database = sqliteD1(...APP_MIGRATIONS);
    const db = createDatabase(database.d1);
    await addDomain(db, 7, 'site.test', 'acme/site');
    const make = (container: unknown) =>
      new ProbeScanner(
        { container } as never,
        { DB: database.d1, ...env } as never,
      );
    const requested = fakeGitHub({
      'https://api.github.com/app/installations/5/access_tokens': () =>
        Response.json({ token: 'ghs_1' }),
      'https://api.github.com/repos/acme/site/contents/': () =>
        new Response('no', { status: 404 }),
      'https://api.github.com/repos/acme/site/issues': () =>
        Response.json({ number: 3, state: 'open' }),
    });
    // The checks' own DNS-over-HTTPS calls go to a stand-in; GitHub's go to the fake.
    const github = globalThis.fetch;
    globalThis.fetch = (async (
      input: Parameters<typeof fetch>[0],
      init?: RequestInit,
    ) =>
      String(input).includes('cloudflare-dns.com')
        ? Response.json({ Status: 3, Answer: [] })
        : github(input, init)) as typeof fetch;
    return { db, make, requested };
  };

  it('runs the job in the request: scans the site, opens the issue, answers 200', async () => {
    const { make, requested } = await setup();
    const { container, asked } = probe();
    const answer = await make(container).fetch(post());
    expect(answer.status).toBe(200);
    expect([...new Set(asked)]).toEqual(['site.test']);
    expect(requested).toContain(
      'POST https://api.github.com/repos/acme/site/issues',
    );
  });

  it('refuses a job that is not JSON', async () => {
    const { make } = await setup();
    const { container, asked } = probe();
    const response = await make(container).fetch(post('nope'));
    expect(response.status).toBe(400);
    expect(asked).toEqual([]);
  });

  it('lets the container stop soon after the job', async () => {
    const { make } = await setup();
    const { container, log } = probe();
    await make(container).fetch(post());
    expect(log.findLast((line) => line.startsWith('idle'))).toBe(
      `idle ${AFTER_JOB_IDLE_MS}`,
    );
  });

  it('answers 200 for a site that did not answer, because that is a result and not a failure', async () => {
    const { make, requested } = await setup();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = probe({
      page: () =>
        new Response('{"error":"the name does not resolve"}', { status: 502 }),
    });
    const response = await make(container).fetch(post());
    expect(response.status).toBe(200);
    expect(requested).not.toContain(
      'POST https://api.github.com/repos/acme/site/issues',
    );
  });

  it('answers 500 when the probe is down, so the queue tries the job again', async () => {
    const { make } = await setup();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = probe({ down: true });
    const answer = await make(container).fetch(post());
    expect(answer.status).toBe(500);
    expect(await answer.text()).toContain('the probe could not be reached');
  });

  it('answers 500 when the probe is too busy to answer', async () => {
    const { make } = await setup();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = probe({
      page: () => new Response('busy', { status: 500 }),
    });
    const response = await make(container).fetch(post());
    expect(response.status).toBe(500);
  });

  it('drops a deployment job when GitHub is not set up', async () => {
    const { make } = await setup({});
    const { container, asked } = probe();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await make(container).fetch(post());
    expect(response.status).toBe(200);
    expect(asked).toEqual([]);
  });

  it('runs a re-check and records it as scheduled', async () => {
    const { db, make } = await setup();
    const { domain } = await addDomain(db, 7, 'site.test', 'acme/site');
    const { container, asked } = probe();
    const response = await make(container).fetch(post(RECHECK));
    expect(response.status).toBe(200);
    expect([...new Set(asked)]).toEqual(['site.test']);
    expect(
      await listRuns(db, 7, { domainId: domain.id, host: 'site.test' }, 10),
    ).toEqual([expect.objectContaining({ kind: 'scheduled', sha: null })]);
  });

  it('does not re-check a repository whose checks were turned off meanwhile', async () => {
    const { db, make } = await setup();
    await disableRepo(db, 7, 'acme/site');
    const { container, asked } = probe();
    const response = await make(container).fetch(post(RECHECK));
    expect(response.status).toBe(200);
    expect(asked).toEqual([]);
  });

  it('answers 500 for a re-check the scanner failed, and records nothing', async () => {
    const { db, make } = await setup();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = probe({ down: true });
    const response = await make(container).fetch(post(RECHECK));
    expect(response.status).toBe(500);
    expect(await latestRuns(db, 7, 'site.test', 1)).toEqual([]);
  });
});
