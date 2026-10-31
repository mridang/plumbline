import { describe, expect, it } from '@jest/globals';
import type { ReactElement } from 'react';

import LoginPage, { metadata } from '@/app/(site)/login/page';
import { html } from '../../../components/render';

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

  it('ignores any other error flag', async () => {
    expect(await page({ error: '<b>x</b>' })).not.toContain('role="alert"');
  });
});
