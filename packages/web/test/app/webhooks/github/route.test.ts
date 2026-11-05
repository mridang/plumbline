import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { POST } from '@/app/webhooks/github/route';
import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import { issueOf, saveIssue } from '@/domain/db/suite';
import {
  listInstallations,
  listRepos,
  saveInstallation,
} from '@/domain/db/github';
import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  settleBackground,
  sqliteD1,
} from '../../../lib/core/db/sqlite-d1';
import {
  DEPLOYED_APP,
  GITHUB_ENV,
  fakeGitHub,
  signed,
} from '../../../domain/github/github-test-kit';

let restore: () => void;
let made: ReturnType<typeof sqliteD1>;
/** The jobs the deliveries left with the scanner's Durable Object. */
let jobs: unknown[];

beforeEach(async () => {
  made = sqliteD1(...APP_MIGRATIONS);
  jobs = [];
  const scanner = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (request: Request) => {
        jobs.push({
          path: new URL(request.url).pathname,
          ...((await request.json()) as object),
        });
        return new Response(null, { status: 202 });
      },
    }),
  };
  restore = installCloudflareContext(made.d1, {
    ...GITHUB_ENV,
    SCANNER: scanner,
  });
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
  deliveryId?: string,
) => {
  const body = JSON.stringify(payload);
  const sig = signature === undefined ? signed(body) : signature;
  return POST(
    new Request('https://plumbline.test/webhooks/github', {
      method: 'POST',
      headers: {
        'x-github-event': event,
        ...(deliveryId ? { 'x-github-delivery': deliveryId } : {}),
        ...(sig ? { 'x-hub-signature-256': sig } : {}),
      },
      body,
    }),
  );
};

describe('POST /webhooks/github', () => {
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
      new Request('https://plumbline.test/webhooks/github', {
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

  describe('deployment_status', () => {
    const deployment = (
      state = 'success',
      environment = 'Production',
      more: Record<string, unknown> = {},
    ) => ({
      installation: { id: 5 },
      deployment_status: { state, environment, ...more },
      deployment: { sha: 'abc' },
      repository: { full_name: 'acme/site' },
    });

    const job = (more: Record<string, unknown> = {}) => ({
      path: '/jobs',
      installationId: 5,
      userId: 7,
      appUrl: 'https://plumbline.test',
      ...more,
    });

    beforeEach(async () => {
      await addDomain(createDatabase(made.d1), 7, 'site.test', 'acme/site');
    });

    it('leaves a job for the live site after a successful deployment, and does not wait for the scan', async () => {
      const requested = fakeGitHub({});
      const res = await deliver('deployment_status', deployment());
      expect(res.status).toBe(202);
      expect(jobs).toEqual([
        job({
          deployed: {
            environment: 'production',
            repo: 'acme/site',
            sha: 'abc',
            url: null,
          },
        }),
      ]);
      expect(requested).toEqual([]);
    });

    it('leaves a job for a preview with its own address', async () => {
      await deliver(
        'deployment_status',
        deployment('success', 'Preview', {
          environment_url: 'https://pr-3.site.test/',
        }),
      );
      expect(jobs).toEqual([
        job({
          deployed: {
            environment: 'preview',
            repo: 'acme/site',
            sha: 'abc',
            url: 'https://pr-3.site.test/',
          },
        }),
      ]);
    });

    it('leaves nothing for a preview that names no address', async () => {
      await deliver('deployment_status', deployment('success', 'Preview'));
      expect(jobs).toEqual([]);
    });

    it('leaves nothing for a deployment that has not succeeded', async () => {
      await deliver('deployment_status', deployment('pending'));
      await deliver('deployment_status', deployment('failure', 'Preview'));
      expect(jobs).toEqual([]);
    });

    it('leaves one job for a delivery GitHub sends again', async () => {
      await deliver('deployment_status', deployment(), undefined, 'abc-1');
      await deliver('deployment_status', deployment(), undefined, 'abc-1');
      expect(jobs).toHaveLength(1);
    });

    it('leaves nothing for an installation nobody has linked', async () => {
      await deliver('deployment_status', {
        ...deployment(),
        installation: { id: 999 },
      });
      expect(jobs).toEqual([]);
    });

    it('still answers 202 when the scanner is not there to take the job', async () => {
      restore();
      restore = installCloudflareContext(made.d1, GITHUB_ENV);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      expect((await deliver('deployment_status', deployment())).status).toBe(
        202,
      );
    });
  });

  describe('installation', () => {
    it.each(['new_permissions_accepted', 'unsuspend', 'created'])(
      'reads the installation again after %s',
      async (action) => {
        const requested = fakeGitHub(DEPLOYED_APP);
        expect(
          (await deliver('installation', { action, installation: { id: 5 } }))
            .status,
        ).toBe(202);
        await settleBackground();
        expect(requested.length).toBeGreaterThan(0);
      },
    );

    it.each(['suspend', 'something_new'])(
      'leaves it alone after %s',
      async (action) => {
        const requested = fakeGitHub(DEPLOYED_APP);
        await deliver('installation', { action, installation: { id: 5 } });
        await settleBackground();
        expect(requested).toEqual([]);
      },
    );

    it('reads it again when repositories are removed as well as added', async () => {
      const requested = fakeGitHub(DEPLOYED_APP);
      await deliver('installation_repositories', {
        action: 'removed',
        installation: { id: 5 },
      });
      await settleBackground();
      expect(requested.length).toBeGreaterThan(0);
    });
  });

  describe('a push of the configuration file', () => {
    const push = (
      more: Record<string, unknown> = {},
      files = ['plumbline.yaml'],
    ) => ({
      installation: { id: 5 },
      ref: 'refs/heads/main',
      after: 'new-sha',
      repository: { full_name: 'acme/site', default_branch: 'main' },
      commits: [{ modified: files }],
      ...more,
    });

    beforeEach(async () => {
      await addDomain(createDatabase(made.d1), 7, 'site.test', 'acme/site');
    });

    it.each(['plumbline.yaml', 'plumbline.yml', 'plumbline.json'])(
      'leaves a job to check the live site again under the new rules when %s changes on the default branch',
      async (file) => {
        await deliver('push', push({}, [file]));
        expect(jobs).toEqual([
          {
            path: '/jobs',
            installationId: 5,
            userId: 7,
            force: true,
            appUrl: 'https://plumbline.test',
            deployed: {
              environment: 'production',
              repo: 'acme/site',
              sha: 'new-sha',
              url: null,
            },
          },
        ]);
      },
    );

    it('leaves a job again even a moment after the last one', async () => {
      await deliver('push', push());
      await deliver('push', push());
      expect(jobs).toHaveLength(2);
    });

    it('leaves nothing when another file changes', async () => {
      await deliver('push', push({}, ['src/a.ts', 'docs/plumbline.yaml']));
      expect(jobs).toEqual([]);
    });

    it('leaves nothing for a push to another branch', async () => {
      await deliver('push', push({ ref: 'refs/heads/feature' }));
      expect(jobs).toEqual([]);
    });

    it('leaves nothing for an installation nobody has linked', async () => {
      await deliver('push', push({ installation: { id: 999 } }));
      expect(jobs).toEqual([]);
    });
  });

  describe('issues', () => {
    const issueEvent = (action: string, sender = 'someone', number = 12) => ({
      action,
      installation: { id: 5 },
      repository: { full_name: 'acme/site' },
      issue: { number },
      sender: { login: sender },
    });

    /** What the fake GitHub is asked: the installation token, then edits and comments. */
    let asked: string[];

    beforeEach(async () => {
      asked = fakeGitHub({
        'https://api.github.com/app/installations/5/access_tokens': () =>
          Response.json({ token: 'ghs_1' }),
        'https://api.github.com/repos/acme/site/issues/12/comments': () =>
          Response.json({ id: 1 }),
        'https://api.github.com/repos/acme/site/issues/12': () =>
          Response.json({ id: 12, number: 12, state: 'open' }),
      });
      await saveIssue(
        createDatabase(made.d1),
        'acme/site',
        'site.test',
        'seo-viewport',
        { number: 12, state: 'open', signature: 'sig', reopens: 0 },
      );
    });

    const stored = () =>
      issueOf(
        createDatabase(made.d1),
        'acme/site',
        'site.test',
        'seo-viewport',
      );

    it('reopens an issue a person closed while the problem is still there, and counts it', async () => {
      expect((await deliver('issues', issueEvent('closed'))).status).toBe(202);
      expect(await stored()).toMatchObject({
        state: 'open',
        signature: 'sig',
        reopens: 1,
      });
      expect(asked).toEqual([
        'POST https://api.github.com/app/installations/5/access_tokens',
        'PATCH https://api.github.com/repos/acme/site/issues/12',
        'POST https://api.github.com/repos/acme/site/issues/12/comments',
      ]);
    });

    it('notes an issue a person reopened', async () => {
      await saveIssue(
        createDatabase(made.d1),
        'acme/site',
        'site.test',
        'seo-viewport',
        { number: 12, state: 'dismissed', signature: 'sig', reopens: 3 },
      );
      await deliver('issues', issueEvent('reopened'));
      expect((await stored())?.state).toBe('open');
      expect(asked).toEqual([]);
    });

    it('ignores what the app did itself', async () => {
      await deliver('issues', issueEvent('closed', 'plumbline-test[bot]'));
      expect((await stored())?.state).toBe('open');
      expect(asked).toEqual([]);
    });

    it('forgets an issue that was deleted, whoever deleted it', async () => {
      await deliver('issues', issueEvent('deleted', 'plumbline-test[bot]'));
      expect(await stored()).toBeUndefined();
    });

    it('ignores an issue the app did not open, and other changes to its own', async () => {
      await deliver('issues', issueEvent('closed', 'someone', 99));
      await deliver('issues', issueEvent('edited'));
      await deliver('issues', issueEvent('labeled'));
      expect((await stored())?.state).toBe('open');
      expect(asked).toEqual([]);
    });
  });
});
