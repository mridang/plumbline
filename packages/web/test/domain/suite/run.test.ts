import { describe, expect, it } from '@jest/globals';

import { sha256Hex, suiteRunOf } from '@/domain/suite/run';
import type { ScanOutcome, ScanResult } from '@/domain/suite/scanner';

const outcome = (
  id: string,
  status: ScanOutcome['status'],
  messages: string[] = [],
): ScanOutcome => ({
  id,
  status,
  findings: messages.map((message) => ({ level: 'warning', message })),
});

const scan = (...outcomes: ScanOutcome[]): ScanResult => ({
  finalUrl: 'https://x.test/',
  status: 200,
  outcomes,
});

describe('sha256Hex', () => {
  it('is the SHA-256 of the text in hex', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('suiteRunOf', () => {
  it('carries the address, status, the checks that ran and the ones that did not', async () => {
    const run = await suiteRunOf(
      scan(
        outcome('seo-links', 'warned', ['Broken link.']),
        outcome('agent-webmcp', 'skipped'),
      ),
    );
    expect(run).toMatchObject({
      url: 'https://x.test/',
      status: 200,
      checks: [
        {
          id: 'seo-links',
          findings: [{ severity: 'warning', message: 'Broken link.' }],
        },
      ],
      skipped: ['agent-webmcp'],
    });
  });

  it('hashes what was found the same whatever order the checks finished in', async () => {
    const a = outcome('a', 'warned', ['x']);
    const b = outcome('b', 'passed');
    expect((await suiteRunOf(scan(a, b))).hash).toBe(
      (await suiteRunOf(scan(b, a))).hash,
    );
  });

  it('hashes differently when a finding or the status differs', async () => {
    const base = (await suiteRunOf(scan(outcome('a', 'warned', ['x'])))).hash;
    expect(
      (await suiteRunOf(scan(outcome('a', 'warned', ['y'])))).hash,
    ).not.toBe(base);
    expect(
      (
        await suiteRunOf({
          ...scan(outcome('a', 'warned', ['x'])),
          status: 500,
        })
      ).hash,
    ).not.toBe(base);
  });

  it('refuses a scan where every check was skipped, which found nothing out', async () => {
    await expect(
      suiteRunOf(scan(outcome('a', 'skipped'), outcome('b', 'skipped'))),
    ).rejects.toThrow('ran no checks');
    await expect(suiteRunOf(scan())).rejects.toThrow('ran no checks');
  });
});
