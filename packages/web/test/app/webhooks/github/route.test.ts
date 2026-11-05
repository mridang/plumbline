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

    /**
     * Answers the site, and GitHub with a token,
     * no configuration file, and an issue and a check run when asked for one.
     * Returns the requests made.
     */
    const answers = () =>
      fakeGitHub({
        'https://site.test/': () =>
          new Response('<html></html>', {
            status: 500,
            headers: { 'content-type': 'text/html' },
          }),
        'https://pr-3.site.test/': () =>
          new Response('<html></html>', {
            headers: { 'content-type': 'text/html' },
          }),
        'https://api.github.com/app/installations/5/access_tokens': () =>
          Response.json({ token: 'ghs_1' }),
        'https://api.github.com/repos/acme/site/contents/': () =>
          new Response('no', { status: 404 }),
        'https://api.github.com/repos/acme/site/issues': () =>
          Response.json({ number: 3, state: 'open' }),
        'https://api.github.com/repos/acme/site/check-runs': () =>
          Response.json({ id: 1 }),
      });

    beforeEach(async () => {
      await addDomain(createDatabase(made.d1), 7, 'site.test', 'acme/site');
    });

    it("reads the repository's rules and checks its site after a successful deployment", async () => {
      const requested = answers();
      const res = await deliver('deployment_status', deployment());
      expect(res.status).toBe(202);
      await settleBackground();
      expect(requested).toContain(
        'GET https://api.github.com/repos/acme/site/contents/plumbline.yaml?ref=abc',
      );
      expect(requested).toContain('GET https://site.test/');
      expect(requested).not.toContain(
        'POST https://api.github.com/repos/acme/site/check-runs',
      );
    });

    it('checks a preview at its own address and reports it on the commit', async () => {
      const requested = answers();
      await deliver(
        'deployment_status',
        deployment('success', 'Preview', {
          environment_url: 'https://pr-3.site.test/',
        }),
      );
      await settleBackground();
      expect(requested).toContain('GET https://pr-3.site.test/');
      expect(requested).toContain(
        'POST https://api.github.com/repos/acme/site/check-runs',
      );
      expect(requested).not.toContain('GET https://site.test/');
      expect(requested).not.toContain(
        'POST https://api.github.com/repos/acme/site/issues',
      );
    });

    it('does nothing for a preview that names no address', async () => {
      const requested = answers();
      await deliver('deployment_status', deployment('success', 'Preview'));
      await settleBackground();
      expect(requested).toEqual([]);
    });

    it('does nothing for a deployment that has not succeeded', async () => {
      const requested = answers();
      await deliver('deployment_status', deployment('pending'));
      await deliver('deployment_status', deployment('failure', 'Preview'));
      await settleBackground();
      expect(requested).toEqual([]);
    });

    it('handles a delivery GitHub sends again only once', async () => {
      const requested = answers();
      await deliver('deployment_status', deployment(), undefined, 'abc-1');
      await settleBackground();
      await deliver('deployment_status', deployment(), undefined, 'abc-1');
      await settleBackground();
      expect(
        requested.filter((r) => r === 'GET https://site.test/'),
      ).toHaveLength(1);
    });

    it('ignores an installation nobody has linked', async () => {
      const requested = answers();
      await deliver('deployment_status', {
        ...deployment(),
        installation: { id: 999 },
      });
      await settleBackground();
      expect(requested).toEqual([]);
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

    /** A site with a problem, and a GitHub that has the new file. */
    const fakeSite = () =>
      fakeGitHub({
        'https://site.test/': () => new Response('<html></html>'),
        'https://api.github.com/app/installations/5/access_tokens': () =>
          Response.json({ token: 'ghs_1' }),
        'https://api.github.com/repos/acme/site/contents/plumbline.yaml': () =>
          new Response('issues: off\n'),
        'https://api.github.com/repos/acme/site/issues': () =>
          Response.json({ number: 3, state: 'open' }),
      });

    beforeEach(async () => {
      await addDomain(createDatabase(made.d1), 7, 'site.test', 'acme/site');
    });

    it.each(['plumbline.yaml', 'plumbline.yml', 'plumbline.json'])(
      'checks the live site again under the new rules when %s changes on the default branch',
      async (file) => {
        const requested = fakeSite();
        await deliver('push', push({}, [file]));
        await settleBackground();
        expect(requested).toContain('GET https://site.test/');
        expect(requested).toContain(
          'GET https://api.github.com/repos/acme/site/contents/plumbline.yaml?ref=new-sha',
        );
      },
    );

    it('checks it again even a moment after the last check', async () => {
      const requested = fakeSite();
      await deliver('push', push());
      await settleBackground();
      await deliver('push', push());
      await settleBackground();
      expect(
        requested.filter((r) => r === 'GET https://site.test/'),
      ).toHaveLength(2);
    });

    it('does not check anything when another file changes', async () => {
      const requested = fakeSite();
      await deliver('push', push({}, ['src/a.ts', 'docs/plumbline.yaml']));
      await settleBackground();
      expect(requested).toEqual([]);
    });

    it('does not check anything for a push to another branch', async () => {
      const requested = fakeSite();
      await deliver('push', push({ ref: 'refs/heads/feature' }));
      await settleBackground();
      expect(requested).toEqual([]);
    });

    it('does not check anything for an installation nobody has linked', async () => {
      const requested = fakeSite();
      await deliver('push', push({ installation: { id: 999 } }));
      await settleBackground();
      expect(requested).toEqual([]);
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

    beforeEach(async () => {
      await saveIssue(createDatabase(made.d1), 'acme/site', 'site.test', {
        number: 12,
        state: 'open',
        signature: 'sig',
      });
    });

    const stored = () =>
      issueOf(createDatabase(made.d1), 'acme/site', 'site.test');

    it('notes an issue a person closed, so it is not reopened for the same problems', async () => {
      expect((await deliver('issues', issueEvent('closed'))).status).toBe(202);
      expect(await stored()).toMatchObject({
        state: 'dismissed',
        signature: 'sig',
      });
    });

    it('notes an issue a person reopened', async () => {
      await deliver('issues', issueEvent('closed'));
      await deliver('issues', issueEvent('reopened'));
      expect((await stored())?.state).toBe('open');
    });

    it('ignores what the app did itself', async () => {
      await deliver('issues', issueEvent('closed', 'plumbline-test[bot]'));
      expect((await stored())?.state).toBe('open');
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
    });
  });
});
