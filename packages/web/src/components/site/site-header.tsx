import Link from 'next/link';
import type { ReactElement } from 'react';

import { buttonClass } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import type { User } from '@/domain/db/users';
import { SOURCE_URL } from '@/utils/site';

import { AccountMenu } from '@/components/site/account-menu';
import { firstNameOf } from '@/components/site/first-name';
import { InstallButton } from '@/components/site/install-button';
import { Logo } from '@/components/site/logo';

/** The look of a link in the header. */
const LINK = 'focus-ring text-sm font-medium text-muted hover:text-ink';

/** The sections of the home page the header points to. */
const SECTIONS = [
  { label: 'Checks', href: '/#checks' },
  { label: 'Developers', href: '/#developers' },
] as const;

/**
 * The bar at the top of every page, kept in view while the page scrolls: the
 * mark and the way to the home page's sections and the source on the left;
 * on the right the dashboard and the account menu ("Hi Ada", holding GitHub,
 * connecting an assistant, notifications and signing out) for someone signed
 * in; signing in and a scan for anyone else.
 */
export function SiteHeader({
  user,
}: Readonly<{ user: User | null }>): ReactElement {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur supports-backdrop-filter:bg-surface/70">
      <Container className="flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Site" className="hidden items-center gap-6 md:flex">
            {SECTIONS.map((section) => (
              <a key={section.href} href={section.href} className={LINK}>
                {section.label}
              </a>
            ))}
            <a href={SOURCE_URL} className={LINK}>
              GitHub
            </a>
          </nav>
        </div>
        <nav aria-label="Account" className="flex items-center gap-4">
          <InstallButton />
          {user ? (
            <>
              <Link href="/dashboard" className={LINK}>
                Dashboard
              </Link>
              <AccountMenu
                firstName={firstNameOf(user)}
                name={user.name ?? user.email}
                email={user.email}
                picture={user.picture ?? undefined}
              />
            </>
          ) : (
            <>
              <Link href="/login" className={LINK}>
                Sign in
              </Link>
              <a
                href="/#scan"
                className={buttonClass({
                  variant: 'accent',
                  size: 'sm',
                  className: 'hidden sm:inline-flex',
                })}
              >
                Scan a site
              </a>
            </>
          )}
        </nav>
      </Container>
    </header>
  );
}
