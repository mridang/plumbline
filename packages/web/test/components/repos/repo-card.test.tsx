import { describe, expect, it } from '@jest/globals';

import { RepoCard } from '@/components/repos/repo-card';
import type { RepoStatus } from '@/domain/db/live';
import { htmlAt } from '../render';

/** The clock the page was made with: a day after the first site was checked. */
const NOW = Date.parse('2026-01-02T00:00:00.000Z');

const REPO: RepoStatus = {
  repo: 'acme/site',
  sites: [
    {
      id: 'a',
      host: 'site.example.com',
      state: 'failing',
      errors: 2,
      warnings: 1,
      hints: 0,
      checked_at: '2026-01-01T00:00:00.000Z',
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
      mine: false,
    },
  ],
};

describe('RepoCard', () => {
  const out = htmlAt(<RepoCard now={NOW} repo={REPO} hidden={false} />);

  it('titles the card with the repository, linked to its page', () => {
    expect(out).toMatch(
      /<a[^>]*href="\/repos\/acme\/site"[^>]*>acme\/site<\/a>/,
    );
  });

  it('shows each host as plain text, not as the link to the app page', () => {
    expect(out).toContain('site.example.com');
    expect(out).not.toContain('href="/domains/');
    expect(out).not.toMatch(/href="\/repos[^"]*"[^>]*>site\.example\.com</);
  });

  it('opens the live site in a new tab from a small link', () => {
    expect(out).toContain('href="https://site.example.com"');
    expect(out).toContain('opens in a new tab');
  });

  it('says how each site stands, and the count of sites', () => {
    expect(out).toContain('>Failing</span>');
    expect(out).toContain('2 errors and 1 warning');
    expect(out).toContain('All clear');
    expect(out).toContain('2 sites');
  });

  it('leaves out a count of zero: a site with only warnings says no errors', () => {
    const only = htmlAt(
      <RepoCard
        now={NOW}
        repo={{
          repo: 'acme/other',
          sites: [
            { ...REPO.sites[0]!, errors: 0, warnings: 3, state: 'warning' },
          ],
        }}
        hidden={false}
      />,
    );
    expect(only).toContain('>Warnings</span>');
    expect(only).toContain('3 warnings');
    expect(only).not.toContain('0 errors');
  });

  it('offers to hide the repository', () => {
    expect(out).toContain('>Hide<');
    expect(out).not.toContain('>Unhide<');
  });

  it('offers to unhide a hidden repository, dimmed and said to be hidden', () => {
    const hiddenOut = htmlAt(<RepoCard now={NOW} repo={REPO} hidden />);
    expect(hiddenOut).toContain('>Unhide<');
    expect(hiddenOut).toContain('opacity-70');
    expect(hiddenOut).toContain('hidden from your dashboard');
  });

  it('has no page and no hide control for sites added by hand', () => {
    const byHand = htmlAt(
      <RepoCard now={NOW} repo={{ ...REPO, repo: null }} hidden={false} />,
    );
    expect(byHand).toContain('Added by hand');
    expect(byHand).not.toContain('href="/repos/');
    expect(byHand).not.toContain('>Hide<');
  });
});
