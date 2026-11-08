import { describe, expect, it } from '@jest/globals';

import { ProbeClient } from '../../../src/engine/probe/client.js';
import { runWorkerScan } from '../../../src/engine/probe/worker.js';
import type { ScanEvent } from '../../../src/engine/core.js';
import { fakeProbe, httpAnswer, linesOf, ok } from '../../helpers/probe.js';

const PAGE =
  '<!doctype html><html lang="en"><head><title>Hi</title></head><body>hi</body></html>';

/** A probe for a site whose page is `/`; every other file is a 404. */
function site(): ReturnType<typeof fakeProbe> {
  return fakeProbe((path, body) => {
    if (path === '/v1/http') {
      return ok(
        linesOf(body)['path'] === '/'
          ? httpAnswer(
              200,
              [
                ['Content-Type', 'text/html; charset=utf-8'],
                ['Alt-Svc', 'h3=":443"; ma=86400'],
              ],
              PAGE,
            )
          : httpAnswer(
              404,
              [['Content-Type', 'text/plain']],
              'no',
              'Not Found',
            ),
      );
    }
    return { status: 502, text: '{"error":"not here"}' };
  });
}

async function scan(
  client: ProbeClient,
  address: string,
  only: string[],
): Promise<ScanEvent[]> {
  const events: ScanEvent[] = [];
  await runWorkerScan(client, address, (event) => events.push(event), { only });
  return events;
}

describe('runWorkerScan', () => {
  it('scans a page the probe fetched, and the checks see the headers the site sent', async () => {
    const { client } = site();
    const events = await scan(client, 'https://example.com/', [
      'alt-svc',
      'x-powered-by',
    ]);
    expect(events.map((event) => event.type)).toEqual([
      'ready',
      'done',
      'done',
      'end',
    ]);
    expect(events[0]).toMatchObject({
      finalUrl: 'https://example.com/',
      status: 200,
    });
    const alt = events.find(
      (event) => event.type === 'done' && event.outcome.id === 'alt-svc',
    );
    expect(alt).toMatchObject({ outcome: { status: 'passed' } });
  });

  it('reports a site the probe could not connect to as unreachable', async () => {
    const { client } = fakeProbe(() => ({
      status: 502,
      text: '{"error":"the name does not resolve"}',
    }));
    expect(await scan(client, 'https://nowhere.test/', ['alt-svc'])).toEqual([
      {
        type: 'unreachable',
        detail: 'nowhere.test did not answer. Check the address and try again.',
      },
      { type: 'end' },
    ]);
  });

  it('throws, and says nothing about the site, when the probe itself is down', async () => {
    const { client } = fakeProbe(() => ({ status: 500, text: '' }));
    await expect(
      scan(client, 'https://example.com/', ['alt-svc']),
    ).rejects.toThrow('the probe answered 500');
  });

  it('refuses an address a scan may not use before it asks the probe anything', async () => {
    const { client, sent } = site();
    const events = await scan(client, 'https://example.com:22/', ['alt-svc']);
    expect(events[0]).toEqual({
      type: 'unreachable',
      detail: 'Port 22 cannot be fetched',
    });
    expect(sent).toHaveLength(0);
  });

  it("gives the checks the probe's view of the site, and the real fetch to everything else", async () => {
    const { client, sent } = site();
    await scan(client, 'https://example.com/', ['alt-svc']);
    expect(sent.every((request) => request.path === '/v1/http')).toBe(true);
    expect(globalThis.fetch).not.toBeUndefined();
  });
});
