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
    expect(html(<SiteHeader user={null} />)).toContain('plumbline</a>');
  });

  it('links to the source', () => {
    expect(html(<SiteHeader user={null} />)).toContain(
      'href="https://github.com/mridang/webhint-hints"',
    );
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

  it('shows no account links', () => {
    expect(out).not.toMatch(/href="\/domains"|href="\/connect"|Sign out/);
  });
});

describe('SiteHeader signed in', () => {
  const out = html(<SiteHeader user={ADA} />);

  it('links to the domains', () => {
    expect(out).toContain('href="/domains">Domains</a>');
  });

  it('links to connecting an assistant', () => {
    expect(out).toContain('href="/connect">Connect AI</a>');
  });

  it('offers a way to sign out', () => {
    expect(out).toContain('>Sign out</button>');
  });

  it('does not offer to sign in', () => {
    expect(out).not.toContain('href="/login"');
  });
});
