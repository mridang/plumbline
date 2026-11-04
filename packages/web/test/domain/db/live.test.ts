import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import {
  KEEP_EVENTS,
  STALE_CHECK_MS,
  appendEvent,
  markChecked,
  markChecking,
  overviewOf,
  stateOf,
} from '@/domain/db/live';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const made = () => {
  const { d1, raw } = sqliteD1(...APP_MIGRATIONS);
  return { db: createDatabase(d1), raw };
};

const NOW = Date.parse('2026-01-01T00:10:00.000Z');

describe('appendEvent', () => {
  it('numbers events in order and keeps their text', async () => {
    const { db, raw } = made();
    const first = await appendEvent(db, 1, { type: 'a' });
    const second = await appendEvent(db, 1, { type: 'b' });
    expect(second).toBeGreaterThan(first);
    expect(
      raw.prepare('SELECT payload FROM live_events ORDER BY id').all(),
    ).toEqual([{ payload: '{"type":"a"}' }, { payload: '{"type":"b"}' }]);
  });

  it('keeps only the newest events of a person and leaves other people alone', async () => {
    const { db, raw } = made();
    await appendEvent(db, 2, { other: true });
    for (let n = 0; n < KEEP_EVENTS + 20; n += 1) {
      await appendEvent(db, 1, { n });
    }
    const mine = raw
      .prepare('SELECT COUNT(*) AS n FROM live_events WHERE user_id = 1')
      .get();
    expect(Number(mine?.['n'])).toBeLessThanOrEqual(KEEP_EVENTS + 1);
    expect(Number(mine?.['n'])).toBeGreaterThan(KEEP_EVENTS - 1);
    expect(
      raw
        .prepare('SELECT COUNT(*) AS n FROM live_events WHERE user_id = 2')
        .get(),
    ).toEqual({ n: 1 });
  });
});

describe('stateOf', () => {
  const row = (over: Partial<Parameters<typeof stateOf>[0]> = {}) => ({
    checking_since: null,
    errors: 0,
    warnings: 0,
    reachable: 1,
    ...over,
  });

  it('is running while a recent check is under way', () => {
    expect(
      stateOf(row({ checking_since: new Date(NOW - 1000).toISOString() }), NOW),
    ).toBe('running');
  });

  it('does not wait for a check that began long ago and never ended', () => {
    expect(
      stateOf(
        row({
          checking_since: new Date(NOW - STALE_CHECK_MS - 1).toISOString(),
        }),
        NOW,
      ),
    ).toBe('ok');
  });

  it('tells apart every other state', () => {
    expect(stateOf(row({ errors: null }), NOW)).toBe('unchecked');
    expect(stateOf(row({ errors: null, reachable: 0 }), NOW)).toBe(
      'unreachable',
    );
    expect(stateOf(row({ reachable: 0 }), NOW)).toBe('unreachable');
    expect(stateOf(row({ errors: 1 }), NOW)).toBe('failing');
    expect(stateOf(row({ warnings: 1 }), NOW)).toBe('warning');
    expect(stateOf(row(), NOW)).toBe('ok');
  });
});

describe('markChecking, markChecked and overviewOf', () => {
  it('follows a check from unchecked, to running, to what it found', async () => {
    const { db } = made();
    await addDomain(db, 1, 'a.test', 'acme/site');
    expect((await overviewOf(db, 1, NOW))[0]?.sites[0]?.state).toBe(
      'unchecked',
    );

    await markChecking(db, 1, 'a.test', new Date(NOW).toISOString());
    expect((await overviewOf(db, 1, NOW))[0]?.sites[0]?.state).toBe('running');

    await markChecked(db, 1, 'a.test', {
      counts: { errors: 2, warnings: 1, hints: 5 },
      at: 't',
    });
    expect((await overviewOf(db, 1, NOW))[0]?.sites[0]).toMatchObject({
      state: 'failing',
      errors: 2,
      warnings: 1,
      hints: 5,
    });
  });

  it('records a site that did not answer without losing the last counts', async () => {
    const { db } = made();
    await addDomain(db, 1, 'a.test');
    await markChecked(db, 1, 'a.test', {
      counts: { errors: 0, warnings: 0, hints: 0 },
      at: 't',
    });
    await markChecked(db, 1, 'a.test', { counts: null, at: 't2' });
    expect((await overviewOf(db, 1, NOW))[0]?.sites[0]?.state).toBe(
      'unreachable',
    );
  });

  it('groups sites by repository, with the ones added by hand last', async () => {
    const { db } = made();
    await addDomain(db, 1, 'hand.test');
    await addDomain(db, 1, 'b.test', 'acme/b');
    await addDomain(db, 1, 'a.test', 'acme/a');
    await addDomain(db, 2, 'theirs.test', 'acme/c');
    expect((await overviewOf(db, 1, NOW)).map((r) => r.repo)).toEqual([
      'acme/a',
      'acme/b',
      null,
    ]);
  });
});
