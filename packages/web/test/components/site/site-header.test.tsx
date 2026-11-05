import { describe, expect, it } from '@jest/globals';

import { SiteHeader } from '@/components/site/site-header';
import type { User } from '@/domain/db/users';
import { html } from '../render';

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

describe('SiteHeader', () => {
  it('shows the logo', () => {
    expect(html(<SiteHeader user={null} />)).toContain('Plumbline</a>');
  });

  it('links to the source', () => {
    expect(html(<SiteHeader user={null} />)).toContain(
      'href="https://github.com/mridang/plumbline"',
    );
  });

  it('points to the home page’s checks and developer sections', () => {
    const out = html(<SiteHeader user={null} />);
    expect(out).toContain('href="/#checks"');
    expect(out).toContain('href="/#developers"');
  });

  it('stays in view while the page scrolls', () => {
    expect(html(<SiteHeader user={null} />)).toContain('sticky top-0');
  });

  it('offers no install button until the browser offers one', () => {
    expect(html(<SiteHeader user={null} />)).not.toContain('Install app');
  });
});

describe('SiteHeader signed out', () => {
  const out = html(<SiteHeader user={null} />);

  it('offers to sign in, on the sign-in page', () => {
    expect(out).toContain('href="/login">Sign in</a>');
  });

  it('offers a scan, as the main action', () => {
    expect(out).toMatch(/href="\/#scan"[^>]*>Scan a site<\/a>/);
  });

  it('shows no account links', () => {
    expect(out).not.toMatch(/href="\/domains"|href="\/connect"|Sign out/);
  });
});

describe('SiteHeader signed in', () => {
  const out = html(<SiteHeader user={ADA} />);

  it('links to the dashboard', () => {
    expect(out).toContain('href="/dashboard">Dashboard</a>');
  });

  it('greets the person by their first name in the account menu', () => {
    expect(out).toContain('Hi Ada');
  });

  it('holds the account links in the menu, not in the bar', () => {
    expect(out).not.toMatch(
      /href="\/domains"|href="\/connect"|href="\/github"/,
    );
    expect(out).not.toContain('>Sign out<');
  });

  it('does not offer the scan button, which is for visitors', () => {
    expect(out).not.toContain('Scan a site');
  });

  it('does not offer to sign in', () => {
    expect(out).not.toContain('href="/login"');
  });
});
