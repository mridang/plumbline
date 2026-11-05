import { describe, expect, it } from '@jest/globals';

import { SiteHeader } from '@/components/site/site-header';
import type { User } from '@/domain/db/users';
import { htmlAt } from '../render';

const ADA: User = {
  id: 1,
  google_sub: 'g1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  picture: null,
  session_epoch: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

/** The header as it renders on a page of the app. */
const draw = (user: User | null, pathname = '/') =>
  htmlAt(<SiteHeader user={user} />, { pathname });

describe('SiteHeader', () => {
  it('shows the logo', () => {
    expect(draw(null)).toContain('Plumbline</a>');
  });

  it('stays in view while the page scrolls', () => {
    expect(draw(null)).toContain('sticky top-0');
  });

  it('does not link the source: it is in the footer', () => {
    expect(draw(null)).not.toContain('github.com/mridang/plumbline');
    expect(draw(ADA)).not.toContain('github.com/mridang/plumbline');
  });

  it('offers no install button until the browser offers one', () => {
    expect(draw(null)).not.toContain('Add to desktop');
  });
});

describe('SiteHeader signed out', () => {
  const out = draw(null);

  it('leads home from the logo', () => {
    expect(out).toMatch(/<a[^>]*href="\/"[^>]*>[^]*?Plumbline<\/a>/);
  });

  it('points to the checks and the docs pages', () => {
    expect(out).toContain('href="/checks"');
    expect(out).toContain('href="/docs"');
  });

  it('offers to sign in, on the sign-in page', () => {
    expect(out).toContain('href="/login"');
  });

  it('offers a scan, as the main action', () => {
    expect(out).toMatch(/href="\/#scan"[^>]*>Scan a site<\/a>/);
  });

  it('has a menu for phones, where the links would not fit', () => {
    expect(out).toContain('aria-label="Menu"');
  });

  it('shows no account links and no dashboard', () => {
    expect(out).not.toMatch(/href="\/dashboard"|href="\/connect"|Sign out/);
  });
});

describe('SiteHeader signed in', () => {
  const out = draw(ADA);

  it('leads to the dashboard from the logo, not the front page', () => {
    expect(out).toMatch(/<a[^>]*href="\/dashboard"[^>]*>[^]*?Plumbline<\/a>/);
    expect(out).not.toMatch(/<a[^>]*href="\/"[^>]*>[^]*?Plumbline<\/a>/);
  });

  it('lists the dashboard, the checks and the docs, in that order', () => {
    const at = ['>Dashboard<', '>Checks<', '>Docs<'].map((text) =>
      out.indexOf(text),
    );
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('greets the person by their first name in the account menu', () => {
    expect(out).toContain('Hi Ada');
  });

  it('holds the account links in the menu, not in the bar', () => {
    expect(out).not.toMatch(/href="\/connect"|href="\/github"/);
    expect(out).not.toContain('>Sign out<');
  });

  it('does not offer the scan button or signing in, which are for visitors', () => {
    expect(out).not.toContain('Scan a site');
    expect(out).not.toContain('href="/login"');
  });

  it('marks the page it is on', () => {
    const marked = draw(ADA, '/checks');
    expect(marked).toMatch(/aria-current="page"[^>]*>Checks</);
    expect(draw(ADA, '/dashboard')).toMatch(
      /aria-current="page"[^>]*>Dashboard</,
    );
  });

  it('keeps the dashboard marked on a repository page', () => {
    expect(draw(ADA, '/repos/acme/site')).toMatch(
      /aria-current="page"[^>]*>Dashboard</,
    );
  });
});
