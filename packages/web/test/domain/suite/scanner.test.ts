import { describe, expect, it } from '@jest/globals';

import {
  JOBS_PATH,
  SiteUnreachable,
  collectScan,
  enqueueJob,
  scanThrough,
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

describe('scanWith and scanThrough', () => {
  const answer = () =>
    new Response(streamOf(ready, done('a', 'passed'), end), { status: 200 });

  it('post the address to the scanner and collect the answer', async () => {
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

  it('fail when the scanner does not answer', async () => {
    await expect(
      scanWith(
        async () => new Response('no', { status: 503 }),
        'https://x.test/',
      ),
    ).rejects.toThrow('did not answer');
  });

  it('go through the namespace, and fail without one', async () => {
    const namespace: ScannerNamespace = {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => answer() }),
    };
    expect((await scanThrough(namespace, 'https://x.test/')).status).toBe(200);
    await expect(scanThrough(undefined, 'https://x.test/')).rejects.toThrow(
      'not available',
    );
  });
});

describe('enqueueJob', () => {
  const job: SuiteJob = {
    installationId: 5,
    userId: 7,
    deployed: {
      environment: 'production',
      repo: 'acme/site',
      sha: 'abc',
      url: null,
    },
    appUrl: 'https://plumbline.test',
  };

  it('posts the job to the namespace on the jobs path', async () => {
    const seen: { url: string; method: string; body: unknown }[] = [];
    const namespace: ScannerNamespace = {
      idFromName: (name) => name,
      get: () => ({
        fetch: async (request) => {
          seen.push({
            url: request.url,
            method: request.method,
            body: await request.json(),
          });
          return new Response(null, { status: 202 });
        },
      }),
    };
    await enqueueJob(namespace, job);
    expect(seen).toEqual([
      {
        url: `https://scanner.internal${JOBS_PATH}`,
        method: 'POST',
        body: job,
      },
    ]);
  });

  it('fails when there is no namespace or the job was not taken', async () => {
    await expect(enqueueJob(undefined, job)).rejects.toThrow('not available');
    const refusing: ScannerNamespace = {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => new Response('no', { status: 500 }) }),
    };
    await expect(enqueueJob(refusing, job)).rejects.toThrow('did not take');
  });
});
