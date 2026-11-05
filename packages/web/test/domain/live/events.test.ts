import { describe, expect, it } from '@jest/globals';

import type { RepoStatus } from '@/domain/db/live';
import {
  applyEvent,
  parseEvent,
  stateAfter,
  tally,
} from '@/domain/live/events';

const site = (host: string, state: RepoStatus['sites'][number]['state']) => ({
  id: host,
  host,
  state,
  errors: 0,
  warnings: 0,
  hints: 0,
  checked_at: null,
  mine: true,
});

const repos: RepoStatus[] = [
  { repo: 'acme/site', sites: [site('a.test', 'ok'), site('b.test', 'ok')] },
  { repo: null, sites: [site('a.test', 'unchecked')] },
];

describe('parseEvent', () => {
  it('reads a started and a finished event', () => {
    expect(
      parseEvent('{"type":"started","host":"a.test","repo":null,"at":"t"}'),
    ).toMatchObject({ type: 'started' });
    expect(
      parseEvent(
        '{"type":"finished","host":"a.test","at":"t","reachable":true}',
      ),
    ).toMatchObject({ type: 'finished' });
  });

  it.each([
    'not json',
    'null',
    '3',
    '{"type":"other","host":"a","at":"t"}',
    '{"type":"started"}',
  ])('ignores %s', (data) => {
    expect(parseEvent(data)).toBeNull();
  });
});

describe('stateAfter', () => {
  const finished = {
    type: 'finished',
    host: 'a',
    repo: null,
    at: 't',
  } as const;

  it('is unreachable when the site did not answer', () => {
    expect(stateAfter({ ...finished, reachable: false })).toBe('unreachable');
  });

  it('is failing with errors, warning with only warnings, and ok otherwise', () => {
    expect(stateAfter({ ...finished, reachable: true, errors: 1 })).toBe(
      'failing',
    );
    expect(stateAfter({ ...finished, reachable: true, warnings: 1 })).toBe(
      'warning',
    );
    expect(stateAfter({ ...finished, reachable: true })).toBe('ok');
  });
});

describe('applyEvent', () => {
  it('marks only the named site of the named repository as running', () => {
    const next = applyEvent(repos, {
      type: 'started',
      host: 'a.test',
      repo: 'acme/site',
      at: 't',
    });
    expect(next[0]?.sites.map((s) => s.state)).toEqual(['running', 'ok']);
    expect(next[1]?.sites[0]?.state).toBe('unchecked');
  });

  it('settles a site on what the check found', () => {
    const next = applyEvent(repos, {
      type: 'finished',
      host: 'b.test',
      repo: 'acme/site',
      reachable: true,
      errors: 2,
      warnings: 1,
      hints: 4,
      at: 'later',
    });
    expect(next[0]?.sites[1]).toMatchObject({
      state: 'failing',
      errors: 2,
      warnings: 1,
      hints: 4,
      checked_at: 'later',
    });
  });

  it('keeps the last counts when the site did not answer', () => {
    const before: RepoStatus[] = [
      { repo: null, sites: [{ ...site('a.test', 'ok'), errors: 3 }] },
    ];
    const next = applyEvent(before, {
      type: 'finished',
      host: 'a.test',
      repo: null,
      reachable: false,
      at: 't',
    });
    expect(next[0]?.sites[0]).toMatchObject({
      state: 'unreachable',
      errors: 3,
    });
  });

  it('ignores a site it does not show', () => {
    expect(
      applyEvent(repos, {
        type: 'started',
        host: 'z.test',
        repo: null,
        at: 't',
      }),
    ).toEqual(repos);
  });
});

describe('tally', () => {
  it('counts the sites in each state', () => {
    expect(tally(repos)).toEqual({
      running: 0,
      unchecked: 1,
      unreachable: 0,
      failing: 0,
      warning: 0,
      ok: 2,
    });
  });
});
