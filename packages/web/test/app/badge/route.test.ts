import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { GET } from '@/app/badge/[owner]/[repo]/[sig]/route';
import { signRepo } from '@/domain/badge/sign';
import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import { markChecked } from '@/domain/db/live';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';

let restore: () => void;
let db: ReturnType<typeof createDatabase>;

beforeEach(() => {
  const made = sqliteD1(...APP_MIGRATIONS);
  db = createDatabase(made.d1);
  restore = installCloudflareContext(made.d1, { SESSION_SECRET: 'secret' });
});
afterEach(() => restore());

const get = async (repo: string, signature: string) => {
  const [owner = '', name = ''] = repo.split('/');
  return GET(new Request('https://plumbline.test/badge'), {
    params: Promise.resolve({ owner, repo: name, sig: `${signature}.svg` }),
  });
};

describe('GET /badge/{owner}/{repo}/{signature}.svg', () => {
  it('shows the score of the repository as a cached image', async () => {
    await addDomain(db, 1, 'a.test', 'acme/site');
    await markChecked(db, 1, 'a.test', {
      counts: { errors: 1, warnings: 0, hints: 0 },
      at: 't',
    });
    const response = await get(
      'acme/site',
      await signRepo('secret', 'acme/site'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/svg+xml');
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=300, s-maxage=300',
    );
    expect(await response.text()).toContain('85%');
  });

  it('says a repository with nothing checked is not checked', async () => {
    await addDomain(db, 1, 'a.test', 'acme/site');
    const response = await get(
      'acme/site',
      await signRepo('secret', 'acme/site'),
    );
    expect(await response.text()).toContain('not checked');
  });

  it('answers 404 to a signature that was not handed out', async () => {
    await addDomain(db, 1, 'a.test', 'acme/site');
    expect((await get('acme/site', '0'.repeat(20))).status).toBe(404);
    expect(
      (await get('acme/other', await signRepo('secret', 'acme/site'))).status,
    ).toBe(404);
  });
});
