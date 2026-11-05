import { describe, expect, it } from '@jest/globals';

import { CHECKS } from '@/domain/checks/catalogue';
import { keptOutcomes, sha256Hex, suiteRunOf } from '@/domain/suite/run';
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
  raw: outcomes,
});

describe('sha256Hex', () => {
  it('is the SHA-256 of the text in hex', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('keptOutcomes', () => {
  it('is the outcomes as a saved report holds them', () => {
    const kept = keptOutcomes({
      ...scan(),
      raw: [
        {
          id: 'seo-links',
          status: 'warned',
          findings: [
            {
              resource: 'https://x.test/',
              level: 'warning',
              message: 'Broken link.',
            },
          ],
          name: 'ignored',
        },
      ],
    });
    expect(JSON.parse(kept ?? 'null')).toEqual([
      {
        id: 'seo-links',
        status: 'warned',
        findings: [
          {
            resource: 'https://x.test/',
            level: 'warning',
            message: 'Broken link.',
          },
        ],
      },
    ]);
  });

  it('is null for outcomes that are not a valid report, or too large to keep', () => {
    expect(keptOutcomes(scan(outcome('not-a-check', 'passed')))).toBeNull();
    expect(keptOutcomes(scan())).toBeNull();
    expect(keptOutcomes({ ...scan(), raw: ['nope'] })).toBeNull();
    // Ten checks of fifty findings of 2,000 characters each is about 1 MB.
    const heavy = CHECKS.slice(0, 10).map((check) => ({
      id: check.id,
      status: 'warned' as const,
      findings: Array.from({ length: 50 }, () => ({
        resource: 'https://x.test/',
        level: 'warning' as const,
        message: 'x'.repeat(1990),
      })),
    }));
    expect(keptOutcomes({ ...scan(), raw: heavy })).toBeNull();
  });
});

describe('suiteRunOf', () => {
  it('counts the checks that ended each way and keeps the outcomes to open the run', async () => {
    const run = await suiteRunOf(
      scan(
        outcome('seo-links', 'warned', ['x']),
        outcome('seo-viewport', 'passed'),
        outcome('seo-h1-missing', 'failed', ['y']),
        outcome('agent-webmcp', 'skipped'),
      ),
    );
    expect(run.counts).toEqual({ passed: 1, warned: 1, failed: 1, skipped: 1 });
    expect(JSON.parse(run.outcomes ?? 'null')).toHaveLength(4);
  });

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
