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

/** Matches the Google sign-in link. */
const GOOGLE_SIGN_IN_LINK = /href="\/auth\/login"[^>]*>.*Sign in with Google</s;
/** Matches the GitHub sign-in link. */
const GITHUB_SIGN_IN_LINK =
  /href="\/auth\/github"[^>]*>.*Sign in with GitHub</s;
/** Matches the GitHub link styled as primary. */
const GITHUB_PRIMARY_LINK = /href="\/auth\/github"[^>]*class="[^"]*bg-ink/;
/** Matches the Google link styled as secondary. */
const GOOGLE_SECONDARY_LINK =
  /href="\/auth\/login"[^>]*class="[^"]*border-field/;

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

  it('starts the Google sign-in, as the only button when GitHub is not set up', async () => {
    const markup = await page();
    expect(markup).toMatch(GOOGLE_SIGN_IN_LINK);
    expect(markup).toContain('bg-ink');
    expect(markup).not.toContain('Sign in with GitHub');
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
    expect(markup).toMatch(GITHUB_SIGN_IN_LINK);
    expect(markup).toContain('repositories you have access to');
  });

  it('puts GitHub first and primary, and Google second as the quiet button', async () => {
    withSettings(GITHUB_ENV);
    const markup = await page();
    expect(markup.indexOf('Sign in with GitHub')).toBeLessThan(
      markup.indexOf('Sign in with Google'),
    );
    expect(markup).toMatch(GITHUB_PRIMARY_LINK);
    expect(markup).toMatch(GOOGLE_SECONDARY_LINK);
  });

  it.each([
    ['denied', 'Signing in was cancelled.'],
    ['github', 'Signing in with GitHub is not set up here.'],
  ])('says what %s means', async (flag, words) => {
    expect(await page({ error: flag })).toContain(words);
  });

  it('ignores any other error flag', async () => {
    expect(await page({ error: '<b>x</b>' })).not.toContain('role="alert"');
  });
});
