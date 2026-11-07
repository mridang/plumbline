import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { clearGap, listGaps, noteGap } from '@/domain/db/deploy-gaps';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const made = () => {
  const { d1, raw } = sqliteD1(...APP_MIGRATIONS);
  return { db: createDatabase(d1), raw };
};

describe('noteGap and listGaps', () => {
  it('lists the environments of a repository whose deployment reported no address, by name', async () => {
    const { db } = made();
    await noteGap(db, 'o/site', 'prd_foo');
    await noteGap(db, 'o/site', 'production');
    await noteGap(db, 'o/other', 'production');
    expect(await listGaps(db, 'o/site')).toEqual(['prd_foo', 'production']);
    expect(await listGaps(db, 'o/other')).toEqual(['production']);
    expect(await listGaps(db, 'o/none')).toEqual([]);
  });

  it('keeps one note for an environment, however often it is seen', async () => {
    const { db } = made();
    await noteGap(db, 'o/site', 'production', 't1');
    await noteGap(db, 'o/site', 'production', 't2');
    expect(await listGaps(db, 'o/site')).toEqual(['production']);
  });
});

describe('clearGap', () => {
  it('forgets one environment of one repository and nothing else', async () => {
    const { db } = made();
    await noteGap(db, 'o/site', 'production');
    await noteGap(db, 'o/site', 'prd_foo');
    await noteGap(db, 'o/other', 'production');
    await clearGap(db, 'o/site', 'production');
    expect(await listGaps(db, 'o/site')).toEqual(['prd_foo']);
    expect(await listGaps(db, 'o/other')).toEqual(['production']);
  });

  it('does nothing for an environment with no note', async () => {
    const { db } = made();
    await clearGap(db, 'o/site', 'production');
    expect(await listGaps(db, 'o/site')).toEqual([]);
  });
});

describe('the query plan', () => {
  it("reads a repository's notes through the primary key", () => {
    const { raw } = made();
    const plan = raw
      .prepare(
        'EXPLAIN QUERY PLAN SELECT environment FROM deploy_url_gaps WHERE repo = ? ORDER BY environment',
      )
      .all('o/site')
      .map((row) => String(row['detail']))
      .join(' ');
    expect(plan).toMatch(
      /USING (COVERING )?INDEX sqlite_autoindex_deploy_url_gaps_1/,
    );
    expect(plan).not.toMatch(/SCAN/);
  });
});
