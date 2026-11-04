import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import {
  KEEP_DAYS,
  getPreviewReport,
  savePreviewReport,
} from '@/domain/db/preview-reports';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const report = (message = 'm') => ({
  repo: 'acme/site',
  sha: 'abc1234',
  url: 'https://pr-3.site.test/',
  findings: [
    { id: 'seo-viewport', severity: 'error' as const, message },
    { id: 'seo-links', severity: 'hint' as const, message: 'h' },
  ],
});

describe('savePreviewReport and getPreviewReport', () => {
  it('keeps a report under a random id with its counts', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    const id = await savePreviewReport(db, report('boom'));
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await getPreviewReport(db, id)).toMatchObject({
      id,
      repo: 'acme/site',
      errors: 1,
      warnings: 0,
      hints: 1,
      findings: [
        expect.objectContaining({ message: 'boom' }),
        expect.anything(),
      ],
    });
  });

  it('gives each report its own id', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    expect(await savePreviewReport(db, report())).not.toBe(
      await savePreviewReport(db, report()),
    );
  });

  it('knows nothing of an id it did not give', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    expect(await getPreviewReport(db, 'nope')).toBeUndefined();
  });

  it('removes reports older than the time they are kept, and no others', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    const start = new Date('2026-01-01T00:00:00.000Z');
    const old = await savePreviewReport(db, report(), start);
    const recent = await savePreviewReport(
      db,
      report(),
      new Date(start.getTime() + (KEEP_DAYS - 1) * 86_400_000),
    );
    expect(await getPreviewReport(db, old)).toBeDefined();
    const later = await savePreviewReport(
      db,
      report(),
      new Date(start.getTime() + (KEEP_DAYS + 1) * 86_400_000),
    );
    expect(await getPreviewReport(db, old)).toBeUndefined();
    expect(await getPreviewReport(db, recent)).toBeDefined();
    expect(await getPreviewReport(db, later)).toBeDefined();
  });
});
