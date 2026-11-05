import { describe, expect, it } from '@jest/globals';

import { ProblemError } from '@/components/api/problem-message';
import type { HintInfo, HintOutcome } from '@/domain/scan/outcome';
import { runScan } from '@/domain/scan/session';

const info = (id: string): HintInfo => ({
  id,
  name: id,
  description: '',
  section: 'a',
  sectionTitle: 'A',
  sectionOrder: 1,
  groups: [],
  origins: [],
});

const outcome = (id: string): HintOutcome => ({
  ...info(id),
  status: 'passed',
  findings: [],
});

/** NDJSON for the lines given. */
const ndjson = (...lines: unknown[]): string =>
  lines.map((line) => `${JSON.stringify(line)}\n`).join('');

/** A transport that starts a scan and then answers the run with `run`. */
function transport(run: () => Response, calls: string[] = []): typeof fetch {
  return (async (input: unknown, init?: RequestInit) => {
    const path = String(input);
    calls.push(`${init?.method ?? 'GET'} ${path}`);
    if (path === '/api/scans') {
      return Response.json({ id: 'abc.def' }, { status: 201 });
    }
    return run();
  }) as typeof fetch;
}

const READY = {
  type: 'ready',
  finalUrl: 'https://example.com/',
  status: 200,
  hints: [info('one'), info('two')],
};

describe('runScan', () => {
  it('starts a scan, runs it, and reports the start and each check as it finishes', async () => {
    const calls: string[] = [];
    const started: unknown[] = [];
    const finished: string[] = [];
    await runScan(
      'example.com',
      {
        onStart: (start) => started.push(start),
        onOutcome: (done) => finished.push(done.id),
      },
      {
        transport: transport(
          () =>
            new Response(
              ndjson(
                READY,
                { type: 'done', outcome: outcome('two') },
                { type: 'done', outcome: outcome('one') },
                { type: 'end' },
              ),
            ),
          calls,
        ),
      },
    );
    expect(calls).toEqual(['POST /api/scans', 'POST /api/scans/abc.def/run']);
    expect(started).toEqual([
      {
        finalUrl: 'https://example.com/',
        status: 200,
        hints: [info('one'), info('two')],
      },
    ]);
    expect(finished).toEqual(['two', 'one']);
  });

  it('shows only the checks asked for', async () => {
    const started: { hints: readonly HintInfo[] }[] = [];
    const finished: string[] = [];
    await runScan(
      'example.com',
      {
        onStart: (start) => started.push(start),
        onOutcome: (done) => finished.push(done.id),
      },
      {
        only: ['two'],
        transport: transport(
          () =>
            new Response(
              ndjson(
                READY,
                { type: 'done', outcome: outcome('one') },
                { type: 'done', outcome: outcome('two') },
                { type: 'end' },
              ),
            ),
        ),
      },
    );
    expect(started[0]?.hints.map((hint) => hint.id)).toEqual(['two']);
    expect(finished).toEqual(['two']);
  });

  it('rejects with the reason when the page did not answer', async () => {
    await expect(
      runScan(
        'example.com',
        { onStart: () => undefined, onOutcome: () => undefined },
        {
          transport: transport(
            () =>
              new Response(
                ndjson(
                  { type: 'unreachable', detail: 'No answer.' },
                  { type: 'end' },
                ),
              ),
          ),
        },
      ),
    ).rejects.toThrow('No answer.');
  });

  it('rejects when the stream ends before the page was read', async () => {
    await expect(
      runScan(
        'example.com',
        { onStart: () => undefined, onOutcome: () => undefined },
        { transport: transport(() => new Response(ndjson({ type: 'end' }))) },
      ),
    ).rejects.toThrow('The scan stopped.');
  });

  it('shows the problem when the address or the run is refused', async () => {
    const refused = (status: number, detail: string): typeof fetch =>
      (async () =>
        new Response(JSON.stringify({ detail }), {
          status,
          headers: { 'content-type': 'application/problem+json' },
        })) as typeof fetch;
    await expect(
      runScan(
        'x',
        { onStart: () => undefined, onOutcome: () => undefined },
        { transport: refused(429, 'Too soon.') },
      ),
    ).rejects.toBeInstanceOf(ProblemError);
    await expect(
      runScan(
        'x',
        { onStart: () => undefined, onOutcome: () => undefined },
        {
          transport: transport(
            () =>
              new Response(JSON.stringify({ detail: 'Not available.' }), {
                status: 503,
                headers: { 'content-type': 'application/problem+json' },
              }),
          ),
        },
      ),
    ).rejects.toThrow('Not available.');
  });
});
