import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { HintContext } from 'hint';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Severity } from '@hint/utils-types';
import type { CatalogueEntry } from '../../src/engine/catalogue.js';
import { runScan, type ScanEvent } from '../../src/engine/run-scan.js';
import { HTTP_SCHEME } from '../helpers/data.js';

/** A fake check that reports `message` as an error on the page. */
function failing(id: string, message: string): CatalogueEntry {
  return {
    info: {
      id,
      name: id,
      description: '',
      section: 'headers',
      sectionTitle: 'Headers',
      sectionOrder: 1,
      groups: [],
      tags: [],
      origins: [],
    },
    ctor: class {
      public constructor(context: HintContext) {
        context.on('fetch::end::html', () =>
          context.report('r', message, { severity: Severity.error }),
        );
      }
    } as unknown as CatalogueEntry['ctor'],
  };
}

/** A fake check that does nothing wrong. */
function passing(id: string): CatalogueEntry {
  const base = failing(id, '');
  return {
    ...base,
    ctor: class {
      public constructor(context: HintContext) {
        context.on('fetch::end::html', () => undefined);
      }
    } as unknown as CatalogueEntry['ctor'],
  };
}

async function eventsOf(
  address: string,
  options: Parameters<typeof runScan>[2],
): Promise<ScanEvent[]> {
  const events: ScanEvent[] = [];
  await runScan(address, (event) => events.push(event), options);
  return events;
}

describe('runScan', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/down') {
        req.socket.destroy();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        '<!doctype html><html lang="en"><head><title>t</title></head></html>',
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve()),
    );
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(
    () => new Promise((resolve) => server.close(() => resolve(undefined))),
  );

  it('tells what is to run, then each result as it finishes, then ends', async () => {
    const events = await eventsOf(`${base}/`, {
      allowPrivate: true,
      entries: [failing('a-bad', 'nope'), passing('b-good')],
    });
    expect(events.map((e) => e.type)).toEqual(['ready', 'done', 'done', 'end']);
    const ready = events[0];
    expect(ready).toMatchObject({
      type: 'ready',
      finalUrl: `${base}/`,
      status: 200,
    });
    const outcomes = events.flatMap((e) =>
      e.type === 'done' ? [e.outcome] : [],
    );
    expect(Object.fromEntries(outcomes.map((o) => [o.id, o.status]))).toEqual({
      'a-bad': 'failed',
      'b-good': 'passed',
    });
    if (ready?.type === 'ready') {
      expect(ready.hints.map((h) => h.id)).toEqual(['a-bad', 'b-good']);
    }
  });

  it('runs only the checks asked for', async () => {
    const events = await eventsOf(`${base}/`, {
      allowPrivate: true,
      only: ['b-good'],
      entries: [failing('a-bad', 'nope'), passing('b-good')],
    });
    expect(
      events.flatMap((e) => (e.type === 'done' ? [e.outcome.id] : [])),
    ).toEqual(['b-good']);
  });

  it('says the page is unreachable when it does not answer, then ends', async () => {
    const events = await eventsOf(`${base}/down`, {
      allowPrivate: true,
      entries: [passing('b-good')],
    });
    expect(events).toEqual([
      {
        type: 'unreachable',
        detail: `127.0.0.1:${new URL(base).port} did not answer. Check the address and try again.`,
      },
      { type: 'end' },
    ]);
  });

  it.each([
    ['http://127.0.0.1:8080/', 'not a public address'],
    ['http://169.254.169.254/latest/meta-data/', 'not a public address'],
    ['http://localhost:8080/', 'not a public address'],
    [`${HTTP_SCHEME}example.com:22/`, 'Port 22'],
    ['ftp://example.com/', 'Only http and https'],
  ])('refuses to scan %s', async (address, reason) => {
    const events = await eventsOf(address, { entries: [passing('b-good')] });
    expect(events.map((e) => e.type)).toEqual(['unreachable', 'end']);
    expect(JSON.stringify(events[0])).toContain(reason);
  });

  it('skips the checks it has no time left to start', async () => {
    const events = await eventsOf(`${base}/`, {
      allowPrivate: true,
      deadlineMs: -1,
      concurrency: 1,
      entries: [passing('b-good')],
    });
    const done = events.find((e) => e.type === 'done');
    expect(done).toMatchObject({
      outcome: {
        status: 'skipped',
        reason: 'The scan ran out of time before this check started.',
      },
    });
  });

  it('puts the global fetch back when it is over', async () => {
    const before = globalThis.fetch;
    await eventsOf(`${base}/`, { allowPrivate: true, entries: [] });
    expect(globalThis.fetch).toBe(before);
  });
});
