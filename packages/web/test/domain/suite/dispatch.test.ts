import { describe, expect, it, jest } from '@jest/globals';

import { GitHubApi } from '@/domain/github/api';
import {
  CHECKED_EVENT,
  FAILED_EVENT,
  MAX_DISPATCHED,
  dispatchRun,
  eventsFor,
  payloadOf,
} from '@/domain/suite/dispatch';
import type { StoredFinding } from '@/domain/suite/diff';

const found = (
  severity: StoredFinding['severity'],
  message = 'm',
): StoredFinding => ({ id: 'seo-viewport', severity, message });

const run = (findings: StoredFinding[]) => ({
  repo: 'acme/site',
  environment: 'production' as const,
  url: 'https://site.test/',
  sha: 'abc',
  findings,
});

describe('payloadOf', () => {
  it('carries the address, the commit, the conclusion and the counts', () => {
    expect(
      payloadOf(run([found('error'), found('warning'), found('hint')])),
    ).toMatchObject({
      version: 1,
      environment: 'production',
      url: 'https://site.test/',
      host: 'site.test',
      sha: 'abc',
      conclusion: 'failure',
      errors: 1,
      warnings: 1,
      hints: 1,
    });
  });

  it('stays within the ten properties GitHub allows', () => {
    expect(Object.keys(payloadOf(run([])))).toHaveLength(10);
  });

  it('lists no more findings than the limit, and makes their text safe', () => {
    const many = Array.from({ length: MAX_DISPATCHED + 5 }, () =>
      found('warning', '@someone [x](https://evil.test)'),
    );
    const { findings } = payloadOf(run(many)) as {
      findings: { message: string }[];
    };
    expect(findings).toHaveLength(MAX_DISPATCHED);
    expect(findings[0]?.message).not.toMatch(/@[a-z]|\]\(https:\/\//);
  });
});

describe('eventsFor', () => {
  it('sends checked after every run', () => {
    expect(eventsFor(run([]))).toEqual([CHECKED_EVENT]);
    expect(eventsFor(run([found('warning')]))).toEqual([CHECKED_EVENT]);
  });

  it('sends failed as well when there are errors', () => {
    expect(eventsFor(run([found('error')]))).toEqual([
      CHECKED_EVENT,
      FAILED_EVENT,
    ]);
  });
});

describe('dispatchRun', () => {
  const recording = (status = 204) => {
    const bodies: { url: string; body: Record<string, unknown> }[] = [];
    const fetcher = (async (input: unknown, init?: RequestInit) => {
      bodies.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(null, { status });
    }) as typeof fetch;
    return { api: new GitHubApi('t', fetcher), bodies };
  };

  it('posts each event to the repository', async () => {
    const { api, bodies } = recording();
    await dispatchRun(api, run([found('error')]));
    expect(bodies.map((b) => b.url)).toEqual([
      'https://api.github.com/repos/acme/site/dispatches',
      'https://api.github.com/repos/acme/site/dispatches',
    ]);
    expect(bodies.map((b) => b.body['event_type'])).toEqual([
      CHECKED_EVENT,
      FAILED_EVENT,
    ]);
    expect(bodies[0]?.body['client_payload']).toMatchObject({ errors: 1 });
  });

  it('logs a refusal, says what permission is missing, and does not throw', async () => {
    const { api, bodies } = recording(403);
    const logged = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await expect(
      dispatchRun(api, run([found('error')])),
    ).resolves.toBeUndefined();
    expect(bodies).toHaveLength(1);
    expect(String(logged.mock.calls[0]?.[0])).toContain('Contents permission');
    logged.mockRestore();
  });
});
