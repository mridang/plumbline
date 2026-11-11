import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { GET } from '@/app/api/previews/[id]/route';
import { createDatabase } from '@/domain/db/client';
import { savePreviewReport } from '@/domain/db/preview-reports';

import { APP_MIGRATIONS } from '../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../lib/core/db/sqlite-d1';

let restore: () => void;
let db: ReturnType<typeof createDatabase>;

beforeEach(() => {
  const made = sqliteD1(...APP_MIGRATIONS);
  db = createDatabase(made.d1);
  restore = installCloudflareContext(made.d1);
});
afterEach(() => restore());

const get = (id: string) =>
  GET(new Request('https://plumbline.test/api/previews/x'), {
    params: Promise.resolve({ id }),
  });

describe('GET /api/previews/{id}', () => {
  it('gives the report to whoever has the link, without signing in', async () => {
    const id = await savePreviewReport(db, {
      repo: 'acme/site',
      sha: 'abc1234',
      url: 'https://pr-3.site.test/',
      findings: [
        { id: 'seo-viewport', severity: 'error', message: 'no viewport' },
      ],
    });
    const response = await get(id);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(await response.json()).toMatchObject({
      id,
      repo: 'acme/site',
      errors: 1,
      findings: [
        {
          id: 'seo-viewport',
          severity: 'error',
          message: 'no viewport',
          name: expect.any(String),
        },
      ],
    });
  });

  it('answers 404 for anything that is not an id, without asking the database', async () => {
    for (const id of ['x', '../etc/passwd', "' or 1=1", '']) {
      const res = await get(id);
      expect(res.status).toBe(404);
    }
  });

  it('answers 404 as a problem for an id it does not know', async () => {
    const response = await get('00000000-0000-4000-8000-000000000000');
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );
  });
});
