import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { htmlAt } from '../render';
import type { User } from '@/domain/db/users';

/** Who the shell finds signed in. */
interface ShellState {
  user: User | null;
}
const state: ShellState = { user: null };

// eslint-disable-next-line tslop/no-module-mocking -- @/lib/core/auth/current-user is imported directly by the code under test, which has no injection point; ESM needs the module replaced before the import
jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
  getLiveSessionUid: async () => state.user?.id ?? null,
  getSession: async () => null,
  getSessionUid: async () => state.user?.id ?? null,
}));

// eslint-disable-next-line tslop/no-module-mocking -- @/domain/db/client is imported directly by the code under test, which has no injection point; ESM needs the module replaced before the import
jest.unstable_mockModule('@/domain/db/client', () => ({
  getDatabase: () => ({}),
}));
// eslint-disable-next-line tslop/no-module-mocking -- @/domain/db/account-state is imported directly by the code under test, which has no injection point; ESM needs the module replaced before the import
jest.unstable_mockModule('@/domain/db/account-state', () => ({
  connectionState: async () => ({ github: false, assistants: false }),
}));

const { SiteShell } = await import('@/components/site/shell');

/** The shell around a page, rendered as the server would. */
async function shell(): Promise<string> {
  return htmlAt(await SiteShell({ children: <p>page</p> }), {
    pathname: '/dashboard',
  });
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
    expect([...order].toSorted((a, b) => a - b)).toEqual(order);
  });

  it('offers to sign in when nobody is signed in', async () => {
    expect(await shell()).toContain('href="/login"');
  });

  it('shows the dashboard and the account menu to the person signed in', async () => {
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
    const out = await shell();
    expect(out).toContain('href="/dashboard"');
    expect(out).toContain('Hi Ada');
  });
});
