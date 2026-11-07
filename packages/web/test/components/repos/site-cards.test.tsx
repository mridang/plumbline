import { describe, expect, it } from '@jest/globals';

import { SiteCard, SiteCards } from '@/components/repos/site-cards';
import type { RepoStatus } from '@/domain/db/live';
import { htmlAt } from '../render';

const NOW = Date.parse('2026-01-02T00:00:00.000Z');

const REPO: RepoStatus = {
  repo: 'acme/site',
  open_issues: 2,
  sites: [
    {
      id: 'a',
      host: 'site.example.com',
      state: 'failing',
      errors: 2,
      warnings: 1,
      hints: 0,
      checked_at: '2026-01-01T12:00:00.000Z',
      deployed_at: '2026-01-01T00:00:00.000Z',
      sha: 'abcdef1234567890',
      mine: true,
    },
    {
      id: 'b',
      host: 'www.example.com',
      state: 'ok',
      errors: 0,
      warnings: 0,
      hints: 0,
      checked_at: null,
      deployed_at: null,
      sha: null,
      mine: false,
    },
  ],
};

describe('SiteCard', () => {
  const out = htmlAt(<SiteCard repo={REPO} paused={false} now={NOW} />, {
    pathname: '/dashboard',
  });

  it('titles the card with the Octocat and the repository, linked to its page', () => {
    expect(out).toContain('viewBox="0 0 16 16"');
    expect(out).toContain('href="/repos/acme/site?site=site.example.com"');
  });

  it('shows each site as its host with a link out, its state and its bar', () => {
    expect(out).toContain('site.example.com');
    expect(out).toContain('href="https://site.example.com"');
    expect(out).toContain('Failing');
    expect(out).toContain('Passing');
    expect(out).toContain('aria-label="2 failed, 1 with warnings"');
  });

  it('says what was found, when it was checked and deployed, and the commit', () => {
    expect(out).toContain('2 errors · 1 warning');
    expect(out).toContain('12 hours ago');
    expect(out).toContain('yesterday');
    expect(out).toContain('>abcdef1</a>');
  });

  it('counts the sites, the worst state when there are several, and the open issues', () => {
    expect(out).toContain('2 sites');
    expect(out).toContain('2 open');
  });

  it('has a menu for the repository', () => {
    expect(out).toContain('aria-label="Actions for acme/site"');
  });

  it('dims a repository whose checks are paused and says so', () => {
    const paused = htmlAt(<SiteCard repo={REPO} paused now={NOW} />);
    expect(paused).toContain('opacity-60');
    expect(paused).toContain('>Paused<');
  });

  it('is a compact card, not a tall one with a coloured edge', () => {
    expect(out).toContain('p-4');
    expect(out).not.toContain('inset-y-0 left-0');
  });
});

describe('SiteCards', () => {
  it('lays the cards out in a grid that fills the width', () => {
    const out = htmlAt(
      <SiteCards repos={[REPO]} paused={new Set(['acme/site'])} now={NOW} />,
    );
    expect(out).toContain('grid-cols-[repeat(auto-fill');
    expect(out).toContain('opacity-60');
  });
});
