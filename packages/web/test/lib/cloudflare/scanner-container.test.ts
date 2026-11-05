import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import type { SuiteJob } from '@/domain/suite/scanner';

import { GITHUB_ENV, fakeGitHub } from '../../domain/github/github-test-kit';
import { cloudflareWorkersStub } from '../../helpers/cloudflare-workers-stub';
import { APP_MIGRATIONS } from '../core/db/migrations';
import { sqliteD1 } from '../core/db/sqlite-d1';

jest.unstable_mockModule('cloudflare:workers', cloudflareWorkersStub, {
  virtual: true,
} as never);

const { ScannerContainer, IDLE_MS, START_TIMEOUT_MS } =
  await import('@/lib/cloudflare/scanner-container');

/** A container that records how it is used; it answers once `failures` health checks have failed. */
function fake(options: { running?: boolean; failures?: number } = {}) {
  const log: string[] = [];
  let failures = options.failures ?? 0;
  const container = {
    running: options.running ?? false,
    start: (startup: unknown) => {
      log.push(`start ${JSON.stringify(startup)}`);
      container.running = true;
    },
    setInactivityTimeout: async (ms: number | bigint) => {
      log.push(`idle ${ms}`);
    },
    getTcpPort: (port: number) => ({
      fetch: async (input: string, init?: RequestInit) => {
        log.push(`${init?.method ?? 'GET'} ${port} ${input}`);
        if (input.endsWith('/healthz')) {
          if (failures > 0) {
            failures -= 1;
            throw new Error('not listening');
          }
          return new Response('ok');
        }
        const lines = ['{"type":"ready"}\n', '{"type":"end"}\n'];
        return new Response(
          new ReadableStream({
            start(controller) {
              for (const line of lines) {
                controller.enqueue(new TextEncoder().encode(line));
              }
              controller.close();
            },
          }),
          { headers: { 'content-type': 'application/x-ndjson' } },
        );
      },
    }),
  };
  return { container, log };
}

const hub = (container: unknown) =>
  new ScannerContainer({ container } as never, {} as never);

const run = () =>
  new Request('https://scanner.internal/run', {
    method: 'POST',
    body: '{"url":"https://example.com/"}',
  });

describe('ScannerContainer', () => {
  it('starts the container with internet, sets its idle time and forwards the request', async () => {
    const { container, log } = fake();
    const response = await hub(container).fetch(run());
    expect(response.status).toBe(200);
    expect(log.slice(0, 2)).toEqual([
      'start {"enableInternet":true}',
      `idle ${IDLE_MS}`,
    ]);
    expect(log.at(-1)).toBe('POST 8080 http://scanner/run');
  });

  it('hands the answer back as a stream, line by line', async () => {
    const { container } = fake({ running: true });
    const response = await hub(container).fetch(run());
    expect(response.headers.get('content-type')).toBe('application/x-ndjson');
    expect(await response.text()).toBe('{"type":"ready"}\n{"type":"end"}\n');
  });

  it('does not start a container that is already running, but renews its idle time', async () => {
    const { container, log } = fake({ running: true });
    await hub(container).fetch(run());
    expect(log.some((line) => line.startsWith('start'))).toBe(false);
    expect(log).toContain(`idle ${IDLE_MS}`);
  });

  it('waits for a starting container to answer', async () => {
    const { container, log } = fake({ failures: 2 });
    const response = await hub(container).fetch(run());
    expect(response.status).toBe(200);
    expect(log.filter((line) => line.endsWith('/healthz'))).toHaveLength(3);
  });

  it('gives up with 503 when the container never answers', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    try {
      const { container } = fake({ failures: Number.MAX_SAFE_INTEGER });
      const pending = hub(container).fetch(run());
      await jest.advanceTimersByTimeAsync(START_TIMEOUT_MS + 1000);
      expect((await pending).status).toBe(503);
    } finally {
      jest.useRealTimers();
    }
  });

  it('answers 503 when no container is bound', async () => {
    expect((await hub(undefined).fetch(run())).status).toBe(503);
  });
});

/** A Durable Object's storage that keeps what it is given in memory. */
function fakeStorage() {
  const data = new Map<string, unknown>();
  let alarm: number | null = null;
  return {
    data,
    alarmAt: () => alarm,
    put: async (key: string, value: unknown) => {
      data.set(key, value);
    },
    delete: async (key: string) => data.delete(key),
    list: async (options: { prefix: string; limit?: number }) =>
      new Map(
        [...data]
          .filter(([key]) => key.startsWith(options.prefix))
          .slice(0, options.limit),
      ),
    getAlarm: async () => alarm,
    setAlarm: async (at: number) => {
      alarm = at;
    },
  };
}

const lines = (...rows: unknown[]) =>
  rows.map((row) => `${JSON.stringify(row)}\n`).join('');

/** A scan where the page answered and one check failed. */
const FAILED_SCAN = lines(
  { type: 'ready', finalUrl: 'https://site.test/', status: 200 },
  {
    type: 'done',
    outcome: {
      id: 'seo-viewport',
      status: 'failed',
      findings: [{ level: 'error', message: 'no viewport' }],
    },
  },
  {
    type: 'done',
    outcome: { id: 'seo-links', status: 'passed', findings: [] },
  },
  { type: 'end' },
);

/** A running container whose scanner answers `/run` with `answer`, noting the addresses it was asked to scan. */
function scanner(
  answer: (asked: string[]) => Response,
  onRun: () => Promise<void> = async () => undefined,
) {
  const asked: string[] = [];
  const container = {
    running: true,
    start: () => undefined,
    setInactivityTimeout: async () => undefined,
    getTcpPort: () => ({
      fetch: async (input: string, init?: RequestInit) => {
        if (input.endsWith('/healthz')) {
          return new Response('ok');
        }
        asked.push(await new Response(init?.body as BodyInit).text());
        await onRun();
        return answer(asked);
      },
    }),
  };
  return { container, asked };
}

const JOB: SuiteJob = {
  installationId: 5,
  userId: 7,
  deployed: {
    environment: 'production',
    repo: 'acme/site',
    sha: 'abc123',
    url: null,
  },
  appUrl: 'https://plumbline.test',
};

const post = (job: unknown = JOB) =>
  new Request('https://scanner.internal/jobs', {
    method: 'POST',
    body: typeof job === 'string' ? job : JSON.stringify(job),
  });

describe('ScannerContainer, the jobs a deployment leaves', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setup = async (env: Record<string, unknown> = GITHUB_ENV) => {
    const made = sqliteD1(...APP_MIGRATIONS);
    await addDomain(createDatabase(made.d1), 7, 'site.test', 'acme/site');
    const storage = fakeStorage();
    const make = (container: unknown) =>
      new ScannerContainer(
        { container, storage } as never,
        { DB: made.d1, ...env } as never,
      );
    const requested = fakeGitHub({
      'https://api.github.com/app/installations/5/access_tokens': () =>
        Response.json({ token: 'ghs_1' }),
      'https://api.github.com/repos/acme/site/contents/': () =>
        new Response('no', { status: 404 }),
      'https://api.github.com/repos/acme/site/issues': () =>
        Response.json({ number: 3, state: 'open' }),
    });
    return { storage, make, requested };
  };

  it('keeps the job and sets an alarm, and answers 202', async () => {
    const { storage, make } = await setup();
    const { container } = scanner(() => new Response(FAILED_SCAN));
    const answer = await make(container).fetch(post());
    expect(answer.status).toBe(202);
    expect([...storage.data.values()]).toEqual([JOB]);
    expect(storage.alarmAt()).not.toBeNull();
  });

  it('refuses a job that is not JSON, and keeps nothing', async () => {
    const { storage, make } = await setup();
    const { container } = scanner(() => new Response(FAILED_SCAN));
    expect((await make(container).fetch(post('nope'))).status).toBe(400);
    expect(storage.data.size).toBe(0);
  });

  it('runs the job from the alarm: scans the site in the container, opens the issue, then forgets the job', async () => {
    const { storage, make, requested } = await setup();
    const { container, asked } = scanner(() => new Response(FAILED_SCAN));
    const object = make(container);
    await object.fetch(post());
    await object.alarm();
    expect(asked).toEqual(['{"url":"https://site.test/"}']);
    expect(requested).toContain(
      'POST https://api.github.com/repos/acme/site/issues',
    );
    expect(storage.data.size).toBe(0);
  });

  it('forgets a job whose site could not be scanned, so it does not run for ever', async () => {
    const { storage, make, requested } = await setup();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = scanner(
      () =>
        new Response(
          lines({ type: 'unreachable', detail: 'down' }, { type: 'end' }),
        ),
    );
    const object = make(container);
    await object.fetch(post());
    await object.alarm();
    expect(requested).not.toContain(
      'POST https://api.github.com/repos/acme/site/issues',
    );
    expect(storage.data.size).toBe(0);
  });

  it('forgets a job when GitHub is not set up', async () => {
    const { storage, make } = await setup({});
    const { container, asked } = scanner(() => new Response(FAILED_SCAN));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const object = make(container);
    await object.fetch(post());
    await object.alarm();
    expect(asked).toEqual([]);
    expect(storage.data.size).toBe(0);
  });

  it('runs jobs one after another, and sets the alarm again for one that came while it ran', async () => {
    const { storage, make } = await setup();
    let object: InstanceType<typeof ScannerContainer> | undefined;
    let first = true;
    const { container, asked } = scanner(
      () => new Response(FAILED_SCAN),
      async () => {
        if (first) {
          first = false;
          await object?.fetch(
            post({ ...JOB, deployed: { ...JOB.deployed, sha: 'def456' } }),
          );
        }
      },
    );
    object = make(container);
    await object.fetch(post());
    await object.alarm();
    expect(asked).toHaveLength(1);
    expect(storage.data.size).toBe(1);
    expect(storage.alarmAt()).not.toBeNull();
    await object.alarm();
    expect(asked).toHaveLength(2);
    expect(storage.data.size).toBe(0);
  });
});
