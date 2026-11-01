import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { POST } from '@/app/api/github/webhook/route';
import { createDatabase } from '@/domain/db/client';
import {
  listInstallations,
  listRepos,
  saveInstallation,
} from '@/domain/db/github';
import { APP_MIGRATIONS } from '../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  settleBackground,
  sqliteD1,
} from '../../../../lib/core/db/sqlite-d1';
import {
  DEPLOYED_APP,
  GITHUB_ENV,
  fakeGitHub,
  signed,
} from '../../../../domain/github/github-test-kit';

let restore: () => void;
let made: ReturnType<typeof sqliteD1>;

beforeEach(async () => {
  made = sqliteD1(...APP_MIGRATIONS);
  restore = installCloudflareContext(made.d1, GITHUB_ENV);
  await saveInstallation(createDatabase(made.d1), 7, 5, 'acme');
});

afterEach(() => {
  restore();
  jest.restoreAllMocks();
});

/** A delivery of `event` with this payload, signed unless `signature` says otherwise. */
const deliver = (
  event: string,
  payload: unknown,
  signature?: string | null,
) => {
  const body = JSON.stringify(payload);
  const sig = signature === undefined ? signed(body) : signature;
  return POST(
    new Request('https://plumbline.test/api/github/webhook', {
      method: 'POST',
      headers: {
        'x-github-event': event,
        ...(sig ? { 'x-hub-signature-256': sig } : {}),
      },
      body,
    }),
  );
};

describe('POST /api/github/webhook', () => {
  it('refuses a delivery with a wrong or missing signature', async () => {
    expect((await deliver('push', {}, 'sha256=00')).status).toBe(401);
    expect((await deliver('push', {}, null)).status).toBe(401);
  });

  it('answers 503 when GitHub is not set up', async () => {
    restore();
    restore = installCloudflareContext(made.d1, {});
    expect((await deliver('push', {})).status).toBe(503);
  });

  it('answers 400 to a signed body that is not JSON', async () => {
    const body = 'not json';
    const res = await POST(
      new Request('https://plumbline.test/api/github/webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': signed(body) },
        body,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('acknowledges a delivery with no installation and does nothing', async () => {
    expect((await deliver('ping', { zen: 'x' })).status).toBe(202);
  });

  it('forgets an installation that was deleted', async () => {
    const res = await deliver('installation', {
      action: 'deleted',
      installation: { id: 5 },
    });
    expect(res.status).toBe(202);
    expect(await listInstallations(createDatabase(made.d1), 7)).toEqual([]);
  });

  it('reads the installation again when its repositories change', async () => {
    fakeGitHub(DEPLOYED_APP);
    const res = await deliver('installation_repositories', {
      action: 'added',
      installation: { id: 5 },
    });
    expect(res.status).toBe(202);
    await settleBackground();
    expect(
      (await listRepos(createDatabase(made.d1), 7)).map((r) => r.full_name),
    ).toEqual(['acme/site']);
  });

  it('reads the installation again when a push changes a Wrangler file, and not otherwise', async () => {
    const requested = fakeGitHub(DEPLOYED_APP);
    await deliver('push', {
      installation: { id: 5 },
      commits: [{ modified: ['src/a.ts'] }],
    });
    await settleBackground();
    expect(requested).toEqual([]);
    await deliver('push', {
      installation: { id: 5 },
      commits: [{ modified: ['wrangler.jsonc'] }],
    });
    await settleBackground();
    expect(requested.length).toBeGreaterThan(0);
  });

  it('ignores an installation nobody has linked', async () => {
    const requested = fakeGitHub(DEPLOYED_APP);
    await deliver('installation_repositories', { installation: { id: 999 } });
    await settleBackground();
    expect(requested).toEqual([]);
  });
});
