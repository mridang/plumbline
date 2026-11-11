import { describe, expect, it } from '@jest/globals';

import { DEFAULT_SORT, rowsOf } from '@/components/repos/site-rows';
import { SitesTable } from '@/components/repos/sites-table';
import type { RepoStatus } from '@/domain/db/live';
import { htmlAt } from '../render';

/** The clock the page was made with: a day after the first deployment. */
const NOW = Date.parse('2026-01-02T00:00:00.000Z');

const REPOS: RepoStatus[] = [
  {
    repo: 'acme/site',
    open_issues: 3,
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
    ],
  },
  {
    repo: null,
    open_issues: 0,
    sites: [
      {
        id: 'b',
        host: 'hand.example.com',
        state: 'unchecked',
        errors: 0,
        warnings: 0,
        hints: 0,
        checked_at: null,
        deployed_at: null,
        sha: null,
        mine: true,
      },
    ],
  },
];

const draw = (paused = new Set<string>(), sort = DEFAULT_SORT) =>
  htmlAt(
    <SitesTable
      rows={rowsOf(REPOS, paused)}
      sort={sort}
      onSort={() => undefined}
      now={NOW}
    />,
    { pathname: '/dashboard' },
  );

describe('SitesTable', () => {
  const out = draw();

  it('has a row for each site, under the headings of what it says about it', () => {
    expect(out).toContain('<table');
    expect(out).toContain('Your sites and how each stands');
    for (const heading of [
      'Status',
      'Site',
      'Last deployed',
      'Last checked',
      'Commit',
      'Failed',
      'Warned',
      'Issues',
    ]) {
      expect(out).toContain(heading);
    }
    expect(out.match(/<tr/g)).toHaveLength(3);
  });

  it('names the repository with the Octocat, linked to the site’s tab, and the host under it', () => {
    expect(out).toContain('viewBox="0 0 16 16"');
    expect(out).toContain('href="/repos/acme/site?site=site.example.com"');
    expect(out).toContain('>site.example.com</span>');
    expect(out).toContain('href="https://site.example.com"');
    expect(out).toContain('opens in a new tab');
  });

  it('says how the site stands, with a badge, and how long ago it was deployed and checked', () => {
    expect(out).toContain('Failing');
    expect(out).toContain('yesterday');
    expect(out).toContain('12 hours ago');
  });

  it('shows the short commit as a link to GitHub, and dashes where nothing is known', () => {
    expect(out).toContain(
      'href="https://github.com/acme/site/commit/abcdef1234567890"',
    );
    expect(out).toContain('>abcdef1</a>');
    expect(out).toContain('>—<');
  });

  it('shows the counts under their headings, right-aligned, and a dash when never checked', () => {
    expect(out).toContain('<span class="sr-only"> failed</span>');
    expect(out).toContain('<span class="sr-only"> warned</span>');
    expect(out).toContain('failed: not kept for this run');
    expect(out.match(/text-right/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('shows the issues open for the repository, linked to them on GitHub', () => {
    expect(out).toContain('3 open');
    expect(out).toContain('label%3Aplumbline');
  });

  it('has a menu for each row, named for it', () => {
    expect(out).toContain('aria-label="Actions for acme/site"');
    expect(out).toContain('aria-label="Actions for hand.example.com"');
  });

  it('calls a site added by hand that, and links it to its own page', () => {
    expect(out).toContain('Added by hand');
    expect(out).toContain('href="/domains/b"');
  });

  it('marks the column the table is sorted by, and lets the others be pressed', () => {
    expect(out).toContain('aria-sort="ascending"');
    expect(out.match(/aria-sort="none"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('is also a list for phones, with the same rows', () => {
    expect(out).toContain('sm:hidden');
    expect(out.match(/<li/g)).toHaveLength(2);
  });

  it('marks a repository whose checks are paused as a state beside its result, and dims its row', () => {
    const paused = draw(new Set(['acme/site']));
    expect(paused).toContain('>Paused<');
    expect(paused).toContain('opacity-60');
    expect(paused).toContain('Failing');
  });

  it('keeps the state apart from the result: a live row has no state marker', () => {
    expect(draw(new Set())).not.toContain('>Paused<');
    expect(draw(new Set())).not.toContain('Unresponsive');
  });
});
