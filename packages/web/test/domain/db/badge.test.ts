import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { sitesOfRepo } from '@/domain/db/badge';
import { addDomain } from '@/domain/db/domains';
import { markChecked } from '@/domain/db/live';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

describe('sitesOfRepo', () => {
  it('reads how each site of the repository stands, and no other site', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await addDomain(db, 1, 'a.test', 'acme/site');
    await addDomain(db, 2, 'b.test', 'acme/site');
    await addDomain(db, 1, 'c.test', 'acme/other');
    await addDomain(db, 1, 'by-hand.test');
    await markChecked(db, 1, 'a.test', {
      counts: { errors: 2, warnings: 1, hints: 0 },
      at: 't',
    });
    const sites = await sitesOfRepo(db, 'acme/site');
    expect(sites).toHaveLength(2);
    expect(sites).toContainEqual({ state: 'failing', errors: 2, warnings: 1 });
    expect(sites).toContainEqual({
      state: 'unchecked',
      errors: 0,
      warnings: 0,
    });
  });
});
