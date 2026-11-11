import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { ReactElement } from 'react';

import { CHECKS } from '@/domain/checks/catalogue';
import { createDatabase, type Database } from '@/domain/db/client';
import { addDomain, setDomainChecks, type Domain } from '@/domain/db/domains';
import { saveReport } from '@/domain/db/reports';
import { APP_MIGRATIONS } from '../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../lib/core/db/sqlite-d1';
import { htmlAt } from '../../../../components/render';

/** What the page asked Next to redirect to; `redirect` throws, as the real one does. */
class RedirectedError extends Error {
  override name = 'RedirectedError';
  constructor(readonly to: string) {
    super(`redirected to ${to}`);
  }
}

/** Thrown by `notFound`, as the real one throws. */
class NotFoundError extends Error {
  override name = 'NotFoundError';
}

/** The signed-in user, or null for nobody. */
const state: { user: { id: number } | null } = { user: null };

jest.unstable_mockModule('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectedError(to);
  },
  notFound: () => {
    throw new NotFoundError();
  },
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
  usePathname: () => '/',
}));
jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));

const { default: DomainPage, metadata } =
  await import('@/app/(site)/domains/[id]/page');

let db: Database;
let restore: () => void;
let domain: Domain;

beforeEach(async () => {
  state.user = { id: 1 };
  const { d1 } = sqliteD1(...APP_MIGRATIONS);
  db = createDatabase(d1);
  restore = installCloudflareContext(d1);
  ({ domain } = await addDomain(db, 1, 'example.com'));
});

afterEach(() => restore());

/** Render the page for a domain id and the picked report. */
function render(
  id: string,
  report?: string,
  view?: string,
): Promise<ReactElement> {
  return DomainPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({
      ...(report === undefined ? {} : { report }),
      ...(view === undefined ? {} : { view }),
    }),
  });
}

/** The page's HTML. */
async function page(
  id = domain.id,
  report?: string,
  view?: string,
): Promise<string> {
  return htmlAt(await render(id, report, view), {
    pathname: `/domains/${id}`,
  });
}

/** Save a report of the domain with this many failed checks. */
function report(failed: number, message = 'No CSP') {
  return saveReport(db, 1, domain.id, {
    url: 'https://example.com/',
    passed: 0,
    warned: 0,
    failed,
    skipped: 0,
    outcomes: [
      {
        id: 'csp',
        status: 'failed',
        findings: [
          { resource: 'https://example.com/', message, level: 'error' },
        ],
      },
    ],
  });
}

describe('DomainPage', () => {
  it('has a tab title', () => {
    expect(metadata.title).toBe('Domain');
  });

  it('sends someone not signed in to sign in and back to this domain', async () => {
    state.user = null;
    const back = `/domains/${domain.id}`;
    await expect(render(domain.id)).rejects.toEqual(
      new RedirectedError(`/auth/login?returnTo=${encodeURIComponent(back)}`),
    );
  });

  it('is not found for an id that is not a domain id', async () => {
    await expect(render('not-an-id')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('is not found for someone else’s domain', async () => {
    state.user = { id: 2 };
    await expect(render(domain.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('is headed with the domain', async () => {
    expect(await page()).toContain('example.com</h1>');
  });

  it('counts the checks chosen for the domain, on the button that opens the choice', async () => {
    await setDomainChecks(db, 1, domain.id, ['csp']);
    expect(await page()).toContain(`Choose checks (1/${CHECKS.length})`);
  });

  it('offers to run the chosen checks', async () => {
    expect(await page()).toContain(`Run ${CHECKS.length} checks`);
  });

  it('says there is no report yet', async () => {
    expect(await page()).toContain('No report yet');
  });

  it('draws the newest report in full', async () => {
    await report(1, 'older');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await report(1, 'newest');
    const out = await page();
    expect(out).toContain('newest');
    expect(out).not.toContain('older');
  });

  it('draws the report that was picked', async () => {
    const older = await report(1, 'older');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await report(1, 'newest');
    expect(await page(domain.id, older.id)).toContain('older');
  });

  it('marks the report shown in the history of runs', async () => {
    const saved = await report(2);
    expect(await page()).toMatch(
      new RegExp(
        String.raw`aria-current="true"[^>]*href="/domains/${domain.id}\?report=${saved.id}"|href="/domains/${domain.id}\?report=${saved.id}"[^>]*aria-current="true"`,
      ),
    );
  });

  it('draws the newest report for a picked id that is not a report id', async () => {
    await report(1, 'newest');
    expect(await page(domain.id, 'nope')).toContain('newest');
  });

  it('draws no report for a picked report that does not exist', async () => {
    await report(1);
    expect(await page(domain.id, crypto.randomUUID())).not.toContain(
      'Results for',
    );
  });

  it('lists every check in the form, ticked as chosen', async () => {
    await setDomainChecks(db, 1, domain.id, ['csp']);
    expect(await page(domain.id, undefined, 'settings')).toMatch(
      /id="check-csp"[^>]* checked="" value="csp"/,
    );
  });

  it('leaves the checks that were not chosen unticked', async () => {
    await setDomainChecks(db, 1, domain.id, ['csp']);
    expect(await page(domain.id, undefined, 'settings')).toMatch(
      /id="check-etag"[^>]* name="checks" value="etag"/,
    );
  });

  it('does not offer to remove the domain: domains come from GitHub', async () => {
    expect(await page()).not.toContain('Remove domain');
  });

  it('sends a domain found in a repository to the repository’s page, at that site', async () => {
    const { domain: found } = await addDomain(
      db,
      1,
      'found.example.com',
      'acme/site',
    );
    await expect(render(found.id)).rejects.toEqual(
      new RedirectedError('/repos/acme/site?site=found.example.com'),
    );
  });

  it('keeps the report picked when it sends the person on', async () => {
    const { domain: found } = await addDomain(
      db,
      1,
      'found.example.com',
      'acme/site',
    );
    const picked = crypto.randomUUID();
    await expect(render(found.id, picked)).rejects.toEqual(
      new RedirectedError(
        `/repos/acme/site?site=found.example.com&report=${picked}`,
      ),
    );
  });
});
