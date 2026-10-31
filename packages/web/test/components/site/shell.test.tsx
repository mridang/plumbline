import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { User } from '@/domain/db/users';
import { html } from '../render';

/** Who the shell finds signed in. */
const state: { user: User | null } = { user: null };

jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));

const { SiteShell } = await import('@/components/site/shell');

/** The shell around a page, rendered as the server would. */
async function shell(): Promise<string> {
  return html(await SiteShell({ children: <p>page</p> }));
}

beforeEach(() => {
  state.user = null;
});

describe('SiteShell', () => {
  it('puts the skip link first, then the header, the page in main, and the footer', async () => {
    const out = await shell();
    const order = [
      'href="#main"',
      '<header',
      '<main id="main"',
      '<p>page</p>',
      '<footer',
    ].map((marker) => out.indexOf(marker));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('offers to sign in when nobody is signed in', async () => {
    expect(await shell()).toContain('href="/login"');
  });

  it('shows the account links to the person signed in', async () => {
    state.user = {
      id: 1,
      google_sub: 'g1',
      email: 'ada@example.com',
      name: 'Ada',
      picture: null,
      session_epoch: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    expect(await shell()).toContain('href="/domains"');
  });
});
