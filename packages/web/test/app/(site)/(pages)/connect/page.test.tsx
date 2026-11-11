import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';

import { html } from '../../../../components/render';

/** What the page asked Next to redirect to; `redirect` throws, as the real one does. */
class RedirectedError extends Error {
  override name = 'RedirectedError';
  constructor(readonly to: string) {
    super(`redirected to ${to}`);
  }
}

/** The signed-in user, or null for nobody. */
const state: { user: { id: number } | null } = { user: null };

jest.unstable_mockModule('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectedError(to);
  },
}));
jest.unstable_mockModule('next/headers', () => ({
  headers: async () => new Headers({ host: 'plumbline.test' }),
}));
jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));

jest.unstable_mockModule('@/domain/db/client', () => ({
  getDatabase: () => ({}),
}));
jest.unstable_mockModule('@/domain/db/account-state', () => ({
  connectionState: async () => ({ github: false, assistants: false }),
}));

const { default: ConnectPage, metadata } =
  await import('@/app/(site)/(pages)/connect/page');

beforeEach(() => {
  state.user = { id: 1 };
});

/** The page as the signed-in person sees it. */
async function page(): Promise<string> {
  return html((await ConnectPage()) as ReactElement);
}

describe('ConnectPage', () => {
  it('is titled for assistants (MCP)', () => {
    expect(metadata.title).toBe('Assistants (MCP)');
  });

  it('sends someone not signed in to sign in and back here', async () => {
    state.user = null;
    await expect(ConnectPage()).rejects.toEqual(
      new RedirectedError('/auth/login?returnTo=%2Fconnect'),
    );
  });

  it('gives the MCP address on the origin the page is served from', async () => {
    expect(await page()).toContain('>https://plumbline.test/mcp</code>');
  });

  it('tells the assistant to name the server Plumbline', async () => {
    expect(await page()).toContain('name it Plumbline');
  });

  it('says what an assistant may read and change', async () => {
    expect(await page()).toContain(
      'Remove sites, and choose which checks run for each.',
    );
  });

  it('lists the connected apps', async () => {
    expect(await page()).toContain('Connected apps');
  });
});
