import { describe, expect, it } from '@jest/globals';

import { RepoHeader } from '@/components/repos/repo-header';
import { htmlAt } from '../render';

/** Matches a disabled switch button. */
const DISABLED_SWITCH_PATTERN =
  /<button[^>]*role="switch"[^>]*\sdisabled[\s=>]/;

/** Matches the external link to the repository on GitHub. */
const GITHUB_LINK_PATTERN =
  /<a[^>]*href="https:\/\/github.com\/acme\/site"[^>]*target="_blank"/;

/** Matches the muted owner prefix of the repository name. */
const OWNER_PREFIX_PATTERN = /text-muted">acme\/<\/span>/;

/** Matches the repository heading with its icon and site label. */
const REPO_HEADING_WITH_ICON_PATTERN =
  /<h1[^>]*>.*viewBox="0 0 16 16".*site<\/span>/s;

const out = htmlAt(
  <RepoHeader
    repo="acme/site"
    state="failing"
    paused={false}
    control={{ canManage: true, fileOff: false }}
    siteCount={2}
    badgeImage="/badge/acme/site/abc.svg"
    badgeMarkdown="[![Plumbline](x)](y)"
  />,
);

describe('RepoHeader', () => {
  it('names the repository with the Octocat, in the one h1', () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(REPO_HEADING_WITH_ICON_PATTERN);
    expect(out).toMatch(OWNER_PREFIX_PATTERN);
  });

  it('says how the worst site stands and how many sites there are', () => {
    expect(out).toContain('Failing');
    expect(out).toContain('2 sites');
  });

  it('has the switch for the checks, on', () => {
    expect(out).toContain('role="switch"');
    expect(out).toContain('aria-checked="true"');
  });

  it('shows Paused instead of the state when checks are off', () => {
    const paused = htmlAt(
      <RepoHeader
        repo="acme/site"
        state="failing"
        paused
        control={{ canManage: true, fileOff: false }}
        siteCount={2}
        badgeImage="/badge/acme/site/abc.svg"
        badgeMarkdown="[![Plumbline](x)](y)"
      />,
    );
    expect(paused).toContain('>Paused<');
    expect(paused).not.toContain('Failing');
    expect(paused).toContain('aria-checked="false"');
  });

  it('says the file turned checks off, and shows the switch read-only with the reason', () => {
    const file = htmlAt(
      <RepoHeader
        repo="acme/site"
        state="failing"
        paused
        control={{ canManage: true, fileOff: true }}
        siteCount={2}
        badgeImage="/badge/acme/site/abc.svg"
        badgeMarkdown="[![Plumbline](x)](y)"
      />,
    );
    expect(file).toContain('Turned off in plumbline.yaml');
    expect(file).toMatch(DISABLED_SWITCH_PATTERN);
    expect(file).toContain('Set enabled: true in plumbline.yaml');
  });

  it('shows the switch disabled, with the reason, to someone who did not install the app', () => {
    const other = htmlAt(
      <RepoHeader
        repo="acme/site"
        state="failing"
        paused={false}
        control={{ canManage: false, fileOff: false }}
        siteCount={2}
        badgeImage="/badge/acme/site/abc.svg"
        badgeMarkdown="[![Plumbline](x)](y)"
      />,
    );
    expect(other).toMatch(DISABLED_SWITCH_PATTERN);
    expect(other).toContain('Only the person who installed the app');
    expect(other).not.toContain('Turned off in plumbline.yaml');
  });

  it('has the Badge button and a View on GitHub link that opens a new tab', () => {
    expect(out).toContain('>Badge<');
    expect(out).toMatch(GITHUB_LINK_PATTERN);
    expect(out).toContain('View on GitHub');
  });

  it('has no big badge section: the badge is only in its button until opened', () => {
    expect(out).not.toContain('<img');
    expect(out).not.toContain('This is how it looks');
  });
});
