import { describe, expect, it } from '@jest/globals';

import {
  ACCESS_TTL_MS,
  MAX_REPOSITORIES,
  cutoffOf,
  peopleWithAccess,
  replaceAccess,
} from '@/domain/db/access';
import { createDatabase } from '@/domain/db/client';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const made = () => {
  const { d1, raw } = sqliteD1(...APP_MIGRATIONS);
  return { db: createDatabase(d1), raw };
};

const rows = (raw: ReturnType<typeof made>['raw'], user: number) =>
  raw
    .prepare(
      'SELECT repo FROM user_repositories WHERE user_id = ? ORDER BY repo',
    )
    .all(user)
    .map((row) => String(row['repo']));

describe('replaceAccess', () => {
  it('keeps the repositories given, once each', async () => {
    const { db, raw } = made();
    await replaceAccess(db, 1, ['acme/b', 'acme/a', 'acme/a']);
    expect(rows(raw, 1)).toEqual(['acme/a', 'acme/b']);
  });

  it('replaces what was kept before, for that person only', async () => {
    const { db, raw } = made();
    await replaceAccess(db, 1, ['acme/a', 'acme/b']);
    await replaceAccess(db, 2, ['acme/z']);
    await replaceAccess(db, 1, ['acme/c']);
    expect(rows(raw, 1)).toEqual(['acme/c']);
    expect(rows(raw, 2)).toEqual(['acme/z']);
  });

  it('keeps nothing for a person who can reach nothing now', async () => {
    const { db, raw } = made();
    await replaceAccess(db, 1, ['acme/a']);
    await replaceAccess(db, 1, []);
    expect(rows(raw, 1)).toEqual([]);
  });

  it('keeps no more than the limit, and any name safely', async () => {
    const { db, raw } = made();
    const many = Array.from(
      { length: MAX_REPOSITORIES + 5 },
      (_, i) => `o/r${i}`,
    );
    await replaceAccess(db, 1, [...many, `o/it's "quoted"`]);
    expect(rows(raw, 1)).toHaveLength(MAX_REPOSITORIES);
  });
});

describe('peopleWithAccess', () => {
  const NOW = Date.parse('2026-01-01T12:00:00.000Z');

  it('finds the people who can see a repository, and no others', async () => {
    const { db } = made();
    const at = new Date(NOW).toISOString();
    await replaceAccess(db, 1, ['acme/a', 'acme/b'], at);
    await replaceAccess(db, 2, ['acme/a'], at);
    await replaceAccess(db, 3, ['acme/other'], at);
    expect((await peopleWithAccess(db, 'acme/a', NOW)).toSorted()).toEqual([
      1, 2,
    ]);
    expect(await peopleWithAccess(db, 'acme/none', NOW)).toEqual([]);
  });

  it('stops honouring what GitHub said once it is older than the limit', async () => {
    const { db } = made();
    await replaceAccess(db, 1, ['acme/a'], new Date(NOW).toISOString());
    expect(
      await peopleWithAccess(db, 'acme/a', NOW + ACCESS_TTL_MS - 1),
    ).toEqual([1]);
    expect(
      await peopleWithAccess(db, 'acme/a', NOW + ACCESS_TTL_MS + 1),
    ).toEqual([]);
  });

  it('names at most the limit', async () => {
    const { db } = made();
    const at = new Date(NOW).toISOString();
    for (let user = 1; user <= 6; user += 1) {
      await replaceAccess(db, user, ['acme/a'], at);
    }
    expect(await peopleWithAccess(db, 'acme/a', NOW, 4)).toHaveLength(4);
  });
});

describe('cutoffOf', () => {
  it('is the limit before now', () => {
    expect(cutoffOf(Date.parse('2026-01-02T00:00:00.000Z'))).toBe(
      '2026-01-01T12:00:00.000Z',
    );
  });
});
