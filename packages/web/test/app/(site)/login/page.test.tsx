import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { ReactElement } from 'react';

import LoginPage, { metadata } from '@/app/(site)/login/page';
import { html } from '../../../components/render';
import { GITHUB_ENV } from '../../../domain/github/github-test-kit';
import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../lib/core/db/sqlite-d1';

let restore: () => void;

/** Run the page in a Worker that has these settings. */
function withSettings(env: Record<string, unknown>): void {
  restore();
  restore = installCloudflareContext(sqliteD1(...APP_MIGRATIONS).d1, env);
}

beforeEach(() => {
  restore = installCloudflareContext(sqliteD1(...APP_MIGRATIONS).d1, {});
});
afterEach(() => restore());

/** The page for these query parameters. */
async function page(searchParams: { error?: string } = {}): Promise<string> {
  return html(
    (await LoginPage({
      searchParams: Promise.resolve(searchParams),
    })) as ReactElement,
  );
}

describe('LoginPage', () => {
  it('is titled for signing in', () => {
    expect(metadata.title).toBe('Sign in');
  });

  it('starts the Google sign-in', async () => {
    expect(await page()).toMatch(
      /href="\/auth\/login"[^>]*>Sign in with Google</,
    );
  });

  it('shows no error after an ordinary visit', async () => {
    expect(await page()).not.toContain('role="alert"');
  });

  it('says a sign-in did not go through', async () => {
    expect(await page({ error: 'auth' })).toContain(
      'Signing in did not go through. Please try again.',
    );
  });

  it('offers no GitHub sign-in when the app has no GitHub settings', async () => {
    expect(await page()).not.toContain('/auth/github');
  });

  it('offers the GitHub sign-in, and says what it shows, when the app has them', async () => {
    withSettings(GITHUB_ENV);
    const markup = await page();
    expect(markup).toMatch(/href="\/auth\/github"[^>]*>Sign in with GitHub</);
    expect(markup).toContain('repositories you have access to');
  });

  it.each([
    ['denied', 'Signing in was cancelled.'],
    ['github', 'Signing in with GitHub is not set up here.'],
  ])('says what %s means', async (error, words) => {
    expect(await page({ error })).toContain(words);
  });

  it('ignores any other error flag', async () => {
    expect(await page({ error: '<b>x</b>' })).not.toContain('role="alert"');
  });
});
