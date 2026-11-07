import Link from 'next/link';
import type { ReactElement } from 'react';

import { buttonClass } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import type { User } from '@/domain/db/users';

import type { AccountState } from '@/components/site/account-links';
import { AccountMenu } from '@/components/site/account-menu';
import { firstNameOf } from '@/components/site/first-name';
import { InstallButton } from '@/components/site/install-button';
import { Logo } from '@/components/site/logo';
import {
  NavLinks,
  NavMenu,
  SIGNED_IN_LINKS,
  SIGNED_OUT_LINKS,
} from '@/components/site/nav-links';

/**
 * The bar at the top of every page, kept in view while the page scrolls.
 *
 * The mark is the way home: the dashboard for someone signed in (where their
 * work is), the front page for anyone else. Beside it are the places to go:
 * for a person signed in the Dashboard, the Checks and the Docs, with the
 * current one marked; for a visitor the Checks and the Docs. On the right,
 * the account menu ("Hi Ada", holding GitHub, connecting an assistant,
 * notifications and signing out), or signing in and a scan for a visitor.
 * On a phone the places collapse into one menu. The project's source lives in
 * the footer, not here.
 */
export function SiteHeader({
  user,
  state,
}: Readonly<{ user: User | null; state?: AccountState }>): ReactElement {
  const links = user ? SIGNED_IN_LINKS : SIGNED_OUT_LINKS;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur supports-backdrop-filter:bg-surface/70">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Logo href={user ? '/dashboard' : '/'} />
          <NavLinks links={links} />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:block">
            <InstallButton />
          </div>
          {user ? (
            <>
              <NavMenu links={links} />
              <AccountMenu
                firstName={firstNameOf(user)}
                name={user.name ?? user.email}
                email={user.email}
                picture={user.picture ?? undefined}
                {...(state ? { state } : {})}
              />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="focus-ring hidden rounded-control px-3 py-2 text-sm font-medium text-muted hover:text-ink md:block"
              >
                Sign in
              </Link>
              <a
                href="/#scan"
                className={buttonClass({ variant: 'accent', size: 'sm' })}
              >
                Scan a site
              </a>
              <NavMenu links={links} signIn />
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
