import { describe, expect, it } from '@jest/globals';

import type { HintInfo } from '@/domain/scan/catalogue';
import type { HintOutcome } from '@/domain/scan/engine';
import type { FromWorker, ToWorker } from '@/domain/scan/messages';
import { ProblemError } from '@/components/api/problem-message';
import { runScan, type ScanWorker } from '@/domain/scan/pool';

/** A hint's description, for a hint called `id`. */
function info(id: string): HintInfo {
  return {
    id,
    name: id,
    description: '',
    section: 's',
    sectionTitle: 'S',
    sectionOrder: 1,
  };
}

/** A worker that answers like the real one, from `script`. */
class FakeWorker implements ScanWorker {
  public onmessage: ((event: MessageEvent<FromWorker>) => void) | null = null;
  public readonly received: ToWorker[] = [];
  public terminated = false;

  public constructor(
    private readonly answer: (message: ToWorker) => FromWorker | undefined,
  ) {}

  public postMessage(message: ToWorker): void {
    this.received.push(message);
    const reply = this.answer(message);
    if (reply) {
      setTimeout(
        () => this.onmessage?.({ data: reply } as MessageEvent<FromWorker>),
        0,
      );
    }
  }

  public terminate(): void {
    this.terminated = true;
  }
}

/** A worker that loads the page and passes every hint. */
const healthy =
  (hints: readonly HintInfo[]) =>
  (message: ToWorker): FromWorker =>
    message.type === 'load'
      ? { type: 'ready', finalUrl: 'https://example.com/', status: 200, hints }
      : {
          type: 'done',
          outcome: { ...info(message.id), status: 'passed', findings: [] },
        };

/** A server that starts every scan. */
const server = (async () =>
  Response.json(
    { id: 'scan.id', url: 'https://example.com/' },
    { status: 201 },
  )) as unknown as typeof fetch;

describe('runScan', () => {
  it('starts the scan, runs every hint across the workers and stops them', async () => {
    const hints = ['a', 'b', 'c', 'd', 'e'].map(info);
    const workers: FakeWorker[] = [];
    const outcomes: HintOutcome[] = [];
    let started: unknown;
    await runScan(
      'example.com',
      {
        onStart: (start) => {
          started = start;
        },
        onOutcome: (outcome) => outcomes.push(outcome),
      },
      {
        transport: server,
        workers: 3,
        spawn: () => {
          const worker = new FakeWorker(healthy(hints));
          workers.push(worker);
          return worker;
        },
      },
    );
    expect(started).toEqual({
      type: 'ready',
      finalUrl: 'https://example.com/',
      status: 200,
      hints,
    });
    expect(outcomes.map((o) => o.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(workers).toHaveLength(3);
    expect(workers[0]?.received[0]).toEqual({
      type: 'load',
      scanId: 'scan.id',
      url: 'https://example.com/',
    });
    expect(workers.every((worker) => worker.terminated)).toBe(true);
  });

  it('finishes at once when there are no hints', async () => {
    const outcomes: HintOutcome[] = [];
    await runScan(
      'example.com',
      { onStart: () => undefined, onOutcome: (o) => outcomes.push(o) },
      { transport: server, spawn: () => new FakeWorker(healthy([])) },
    );
    expect(outcomes).toEqual([]);
  });

  describe('with only some hints chosen', () => {
    /** Scan with `only`, and what started and ran. */
    async function scanOnly(only: readonly string[]): Promise<{
      started: readonly string[];
      ran: readonly string[];
    }> {
      const hints = ['a', 'b', 'c'].map(info);
      let started: readonly string[] = [];
      const ran: string[] = [];
      await runScan(
        'example.com',
        {
          onStart: (start) => {
            started = start.hints.map((hint) => hint.id);
          },
          onOutcome: (outcome) => ran.push(outcome.id),
        },
        {
          transport: server,
          workers: 1,
          spawn: () => new FakeWorker(healthy(hints)),
          only,
        },
      );
      return { started, ran };
    }

    it('starts with only the chosen hints', async () => {
      expect((await scanOnly(['c', 'a'])).started).toEqual(['a', 'c']);
    });

    it('runs only the chosen hints', async () => {
      expect([...(await scanOnly(['c', 'a'])).ran].sort()).toEqual(['a', 'c']);
    });

    it('ignores a chosen id the scan does not have', async () => {
      expect((await scanOnly(['b', 'nope'])).ran).toEqual(['b']);
    });

    it('runs nothing when nothing is chosen', async () => {
      expect((await scanOnly([])).ran).toEqual([]);
    });
  });

  it('carries on without a spare worker that could not load the page', async () => {
    const hints = ['a', 'b'].map(info);
    let spawned = 0;
    const outcomes: HintOutcome[] = [];
    await runScan(
      'example.com',
      { onStart: () => undefined, onOutcome: (o) => outcomes.push(o) },
      {
        transport: server,
        workers: 2,
        spawn: () => {
          spawned += 1;
          return new FakeWorker(
            spawned === 1
              ? healthy(hints)
              : () => ({ type: 'unreachable', detail: 'down' }),
          );
        },
      },
    );
    expect(outcomes.map((o) => o.id).sort()).toEqual(['a', 'b']);
  });

  it('fails with the server problem when the scan cannot start', async () => {
    const refusing = (async () =>
      Response.json(
        { detail: 'Only public domains can be scanned.' },
        { status: 400 },
      )) as unknown as typeof fetch;
    await expect(
      runScan(
        'localhost',
        { onStart: () => undefined, onOutcome: () => undefined },
        { transport: refusing, spawn: () => new FakeWorker(healthy([])) },
      ),
    ).rejects.toThrow(new ProblemError('Only public domains can be scanned.'));
  });

  it('says the status when the refusal is not a problem document', async () => {
    const broken = (async () =>
      new Response('oops', { status: 500 })) as unknown as typeof fetch;
    await expect(
      runScan(
        'example.com',
        { onStart: () => undefined, onOutcome: () => undefined },
        { transport: broken, spawn: () => new FakeWorker(healthy([])) },
      ),
    ).rejects.toThrow('Request failed (500).');
  });

  it('fails with the reason when the page does not answer, and stops the worker', async () => {
    const worker = new FakeWorker(() => ({
      type: 'unreachable',
      detail: 'example.com did not answer.',
    }));
    await expect(
      runScan(
        'example.com',
        { onStart: () => undefined, onOutcome: () => undefined },
        { transport: server, spawn: () => worker },
      ),
    ).rejects.toThrow('example.com did not answer.');
    expect(worker.terminated).toBe(true);
  });
});
