import Link from 'next/link';
import type { ReactElement } from 'react';

import { Container } from '@/components/ui/layout';
import type { User } from '@/domain/db/users';
import { SOURCE_URL } from '@/utils/site';

import { InstallButton } from '@/components/site/install-button';
import { Logo } from '@/components/site/logo';
import { SignOutButton } from '@/components/site/sign-out-button';

/** The look of a link in the header. */
const LINK = 'focus-ring text-sm text-muted hover:text-ink';

/**
 * The bar at the top of every page: the mark, then the account links (the
 * domains, connecting an assistant and signing out for someone signed in;
 * signing in for anyone else) and the way to the source.
 */
export function SiteHeader({
  user,
}: Readonly<{ user: User | null }>): ReactElement {
  return (
    <header className="border-b border-line bg-surface">
      <Container className="flex h-14 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Account" className="flex items-center gap-4">
          <InstallButton />
          {user ? (
            <>
              <Link href="/domains" className={LINK}>
                Domains
              </Link>
              <Link href="/connect" className={LINK}>
                Connect AI
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className={LINK}>
              Sign in
            </Link>
          )}
          <a href={SOURCE_URL} className={`${LINK} hidden sm:inline`}>
            Source
          </a>
        </nav>
      </Container>
    </header>
  );
}
