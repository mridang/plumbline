import { describe, expect, it } from '@jest/globals';

import {
  JOBS_PATH,
  SiteUnreachable,
  collectScan,
  keyOf,
  runJobThrough,
  scanWith,
  type ScannerNamespace,
  type SuiteJob,
} from '@/domain/suite/scanner';

/** A stream that delivers `chunks` as they are given, whatever their line breaks. */
const streamOf = (...chunks: string[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

const ready = '{"type":"ready","finalUrl":"https://x.test/","status":200}\n';
const done = (id: string, status: string, level = 'warning') =>
  `{"type":"done","outcome":{"id":"${id}","status":"${status}","findings":[{"level":"${level}","message":"m ${id}"}]}}\n`;
const end = '{"type":"end"}\n';

describe('collectScan', () => {
  it('collects the page and each check that finished, however the lines are split', async () => {
    const text =
      ready + done('a', 'warned') + done('b', 'failed', 'error') + end;
    const result = await collectScan(
      streamOf(text.slice(0, 40), text.slice(40)),
    );
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe('https://x.test/');
    expect(result.outcomes.map((o) => [o.id, o.status])).toEqual([
      ['a', 'warned'],
      ['b', 'failed'],
    ]);
  });

  it('keeps each outcome as the scanner sent it, with every field', async () => {
    const result = await collectScan(
      streamOf(
        ready,
        '{"type":"done","outcome":{"id":"a","status":"passed","findings":[],"name":"A","section":"seo"}}\n',
        end,
      ),
    );
    expect(result.raw).toEqual([
      { id: 'a', status: 'passed', findings: [], name: 'A', section: 'seo' },
    ]);
  });

  it('skips blank lines and lines it does not know', async () => {
    const result = await collectScan(
      streamOf(
        ready,
        '\n',
        '{"type":"progress","n":1}\n',
        done('a', 'passed'),
        end,
      ),
    );
    expect(result.outcomes).toHaveLength(1);
  });

  it('fails with the reason when the site could not be reached', async () => {
    await expect(
      collectScan(
        streamOf(
          '{"type":"unreachable","detail":"x.test did not answer."}\n',
          end,
        ),
      ),
    ).rejects.toThrow(new SiteUnreachable('x.test did not answer.'));
  });

  it('fails when the stream stops before its last line', async () => {
    await expect(
      collectScan(streamOf(ready, done('a', 'passed'))),
    ).rejects.toThrow('stopped before it finished');
  });

  it('fails on a line that is not JSON', async () => {
    await expect(collectScan(streamOf(ready, 'oops\n', end))).rejects.toThrow(
      'not JSON',
    );
  });
});

describe('scanWith', () => {
  const answer = () =>
    new Response(streamOf(ready, done('a', 'passed'), end), { status: 200 });

  it('posts the address to the scanner and collects the answer', async () => {
    const seen: { url: string; body: string }[] = [];
    const result = await scanWith(async (request) => {
      seen.push({ url: request.url, body: await request.text() });
      return answer();
    }, 'https://x.test/');
    expect(seen).toEqual([
      {
        url: 'https://scanner.internal/run',
        body: '{"url":"https://x.test/"}',
      },
    ]);
    expect(result.outcomes).toHaveLength(1);
  });

  it('fails when the scanner does not answer', async () => {
    await expect(
      scanWith(
        async () => new Response('no', { status: 503 }),
        'https://x.test/',
      ),
    ).rejects.toThrow('did not answer');
  });
});

const suiteJob: SuiteJob = {
  installationId: 5,
  userId: 7,
  deployed: {
    environment: 'production',
    name: 'production',
    repo: 'acme/site',
    sha: 'abc',
    url: null,
  },
  appUrl: 'https://plumbline.test',
};

describe('keyOf', () => {
  it('names the work: the repository for a live site, the address for a preview', () => {
    expect(keyOf({ kind: 'deployment', ...suiteJob })).toBe('deploy:acme/site');
    expect(
      keyOf({
        kind: 'deployment',
        ...suiteJob,
        deployed: {
          ...suiteJob.deployed,
          environment: 'preview',
          name: 'preview',
          url: 'https://pr-1.site.test/',
        },
      }),
    ).toBe('preview:acme/site:https://pr-1.site.test/');
  });

  it('keeps a change of rules and a re-check apart from a deployment', () => {
    expect(keyOf({ kind: 'deployment', ...suiteJob, force: true })).toBe(
      'config:acme/site',
    );
    expect(
      keyOf({ kind: 'recheck', userId: 7, host: 'a.test', repo: 'acme/site' }),
    ).toBe('site:7:a.test');
  });
});

describe('runJobThrough', () => {
  const job = { kind: 'deployment', ...suiteJob } as const;

  it('posts the job to the object of that name on the jobs path', async () => {
    const seen: { name: string; url: string; body: unknown }[] = [];
    let named = '';
    const namespace: ScannerNamespace = {
      idFromName: (name) => {
        named = name;
        return name;
      },
      get: () => ({
        fetch: async (request) => {
          seen.push({
            name: named,
            url: request.url,
            body: await request.json(),
          });
          return new Response(null, { status: 200 });
        },
      }),
    };
    await runJobThrough(namespace, 'deploy:acme/site#1', job);
    expect(seen).toEqual([
      {
        name: 'deploy:acme/site#1',
        url: `https://scanner.internal${JOBS_PATH}`,
        body: job,
      },
    ]);
  });

  it('fails when there is no namespace or the object did not run the job', async () => {
    await expect(runJobThrough(undefined, 'x', job)).rejects.toThrow(
      'not available',
    );
    const refusing: ScannerNamespace = {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => new Response('no', { status: 500 }) }),
    };
    await expect(runJobThrough(refusing, 'x', job)).rejects.toThrow(
      'did not run the job (500): no',
    );
  });
});
