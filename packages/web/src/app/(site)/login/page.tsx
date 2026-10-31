import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { CenteredCard } from '@/components/site/centered-card';
import { buttonClass } from '@/components/ui/button';
import { Eyebrow, Heading } from '@/components/ui/layout';

export const dynamic = 'force-dynamic';

/** The tab title of the sign-in page. */
export const metadata: Metadata = { title: 'Sign in' };

/**
 * The sign-in page: one button that starts the Google sign-in
 * (`/auth/login`). When a sign-in did not go through, the callback sends
 * people back here with a fixed `?error=auth` flag, never anything Google said.
 * Scanning a domain needs no account; signing in is for keeping domains,
 * choosing their checks, saving reports and connecting an assistant.
 */
export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ error?: string }>;
}>): Promise<ReactElement> {
  const { error } = await searchParams;
  return (
    <CenteredCard>
      <Eyebrow>Account</Eyebrow>
      <Heading as="h1" variant="h3" className="mt-2">
        Sign in
      </Heading>
      <p className="mt-3 leading-relaxed text-muted">
        Sign in to keep your domains, choose which checks run for each, save
        their reports and connect an assistant. Scanning a domain needs no
        account.
      </p>
      {error === 'auth' ? (
        <p role="alert" className="mt-4 text-failed">
          Signing in did not go through. Please try again.
        </p>
      ) : null}
      <a
        href="/auth/login"
        className={buttonClass({ size: 'lg', className: 'mt-6 w-full' })}
      >
        Sign in with Google
      </a>
    </CenteredCard>
  );
}
