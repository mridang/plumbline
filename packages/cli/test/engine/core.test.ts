import { describe, expect, it, jest } from '@jest/globals';

import {
  neutralWhenUntested,
  runScanWith,
  type ScanEnvironment,
  type ScanEvent,
} from '../../src/engine/core.js';
import { ScanRefused } from '../../src/engine/scannable.js';

const page = (): Response =>
  new Response('<html><head><title>x</title></head><body>hi</body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-test': '1' },
  });

function environment(over: Partial<ScanEnvironment> = {}): {
  env: ScanEnvironment;
  installed: string[];
} {
  const installed: string[] = [];
  return {
    installed,
    env: {
      fetch: (() => Promise.resolve(page())) as typeof fetch,
      assertScannable: () => Promise.resolve(),
      install: () => {
        installed.push('on');
        return () => installed.push('off');
      },
      ...over,
    },
  };
}

async function events(
  env: ScanEnvironment,
  address: string,
  options = {},
): Promise<ScanEvent[]> {
  const out: ScanEvent[] = [];
  await runScanWith(env, address, (event) => out.push(event), options);
  return out;
}

describe('runScanWith', () => {
  it('announces the checks, reports each as it finishes, and ends', async () => {
    const { env, installed } = environment();
    const out = await events(env, 'https://example.com/', {
      only: ['x-powered-by', 'alt-svc'],
    });
    expect(out.map((event) => event.type)).toEqual([
      'ready',
      'done',
      'done',
      'end',
    ]);
    expect(out[0]).toMatchObject({
      type: 'ready',
      finalUrl: 'https://example.com/',
      status: 200,
    });
    expect(
      out
        .filter((event) => event.type === 'done')
        .map((event) => (event as { outcome: { id: string } }).outcome.id)
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(['alt-svc', 'x-powered-by']);
    expect(installed).toEqual(['on', 'off']);
  });

  it('says why a page could not be scanned when the address is refused, and still ends and removes what it installed', async () => {
    const { env, installed } = environment({
      assertScannable: () =>
        Promise.reject(new ScanRefused('Port 22 cannot be fetched')),
    });
    const out = await events(env, 'https://example.com:22/');
    expect(out).toEqual([
      { type: 'unreachable', detail: 'Port 22 cannot be fetched' },
      { type: 'end' },
    ]);
    expect(installed).toEqual(['on', 'off']);
  });

  it('tells the person only what they can act on when the page did not answer, and tells the log the cause', async () => {
    const cause = new Error('socket hang up');
    const diagnose = jest.fn();
    const { env } = environment({
      fetch: (() => Promise.reject(cause)) as typeof fetch,
    });
    const out = await events(env, 'https://example.com/', { diagnose });
    expect(out[0]).toEqual({
      type: 'unreachable',
      detail: 'example.com did not answer. Check the address and try again.',
    });
    expect(diagnose).toHaveBeenCalledWith(cause);
  });

  it('skips the checks it did not start before the deadline', async () => {
    const { env } = environment();
    const out = await events(env, 'https://example.com/', {
      only: ['alt-svc', 'x-powered-by'],
      deadlineMs: -1,
    });
    const outcomes = out
      .filter((event) => event.type === 'done')
      .map(
        (event) =>
          (event as { outcome: { status: string; reason?: string } }).outcome,
      );
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'skipped',
      'skipped',
    ]);
    expect(outcomes[0]?.reason).toContain('ran out of time');
  });

  it('asks the site once for a file however many checks ask for it', async () => {
    const seen: string[] = [];
    const { env } = environment({
      fetch: ((input: string) => {
        seen.push(String(input));
        return Promise.resolve(page());
      }) as unknown as typeof fetch,
    });
    await events(env, 'https://example.com/', {
      only: ['x-powered-by', 'alt-svc', 'x-frame-options'],
    });
    expect(seen.filter((url) => url === 'https://example.com/')).toHaveLength(
      1,
    );
  });
});

describe('neutralWhenUntested', () => {
  const outcome = (
    status: 'passed' | 'failed',
    findings: { level: string; message: string }[],
  ) =>
    ({ id: 'x', status, findings }) as unknown as Parameters<
      typeof neutralWhenUntested
    >[0];

  it('skips a check that only said it could not test, and keeps what it said', () => {
    const result = neutralWhenUntested(
      outcome('passed', [
        {
          level: 'hint',
          message:
            'mx.example.com: Could not test: no TLS connection to mx.example.com:25.',
        },
        {
          level: 'hint',
          message: 'Could not connect to at least one mail server on port 25.',
        },
      ]),
    );
    expect(result.status).toBe('skipped');
    expect(result.reason).toContain('could not be tested');
    expect(result.findings).toHaveLength(2);
  });

  it('leaves a check alone that found something, passed cleanly, or failed', () => {
    const real = outcome('passed', [
      { level: 'hint', message: 'Could not test one, and the other is old.' },
      { level: 'warning', message: 'Something is wrong.' },
    ]);
    expect(neutralWhenUntested(real)).toBe(real);
    const clean = outcome('passed', []);
    expect(neutralWhenUntested(clean)).toBe(clean);
    const failed = outcome('failed', [
      { level: 'hint', message: 'Could not test it.' },
    ]);
    expect(neutralWhenUntested(failed)).toBe(failed);
    const other = outcome('passed', [
      { level: 'hint', message: 'Consider preloading.' },
    ]);
    expect(neutralWhenUntested(other)).toBe(other);
  });
});
