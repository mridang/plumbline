'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

import { MenuIcon } from '@/components/icons';
import { InstallMenuItem } from '@/components/site/install-menu-item';
import { cn } from '@/components/ui/cn';
import { POPOVER_ITEM, Popover } from '@/components/ui/popover';

/** One place the bar leads to. */
export interface NavLink {
  readonly label: string;
  readonly href: string;
  /** Other paths that belong under it, so it stays marked there. */
  readonly also?: readonly string[];
}

/** The bar for someone signed in: where they work, then the references. */
export const SIGNED_IN_LINKS: readonly NavLink[] = [
  { label: 'Dashboard', href: '/dashboard', also: ['/repos', '/github'] },
  { label: 'Checks', href: '/checks' },
  { label: 'Docs', href: '/docs' },
];

/** The bar for a visitor: the two references, and signing in is its own button. */
export const SIGNED_OUT_LINKS: readonly NavLink[] = [
  { label: 'Checks', href: '/checks' },
  { label: 'Docs', href: '/docs' },
];

/** Whether the person is on the link's page, or one that belongs under it. */
export function isCurrent(pathname: string, link: NavLink): boolean {
  return [link.href, ...(link.also ?? [])].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** The links in a row, with the current page marked. Out of sight on phones. */
export function NavLinks({
  links,
}: Readonly<{ links: readonly NavLink[] }>): ReactElement {
  const pathname = usePathname();
  return (
    <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
      {links.map((link) => {
        const current = isCurrent(pathname, link);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'focus-ring rounded-control px-3 py-2 text-sm font-medium transition-colors',
              current ? 'bg-ink/6 text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The same links in a menu, for phones, where the row would not fit. It also
 * holds "Add to home screen" when the browser offers it, and Sign in for a visitor.
 */
export function NavMenu({
  links,
  signIn = false,
}: Readonly<{
  links: readonly NavLink[];
  /** Offer Sign in as the last entry. */
  signIn?: boolean;
}>): ReactElement {
  const pathname = usePathname();
  return (
    <div className="md:hidden">
      <Popover
        label="Menu"
        button={<MenuIcon size="md" />}
        buttonClassName="focus-ring-flush grid size-10 place-items-center rounded-control hover:bg-ink/5 data-[state=open]:bg-ink/5"
        panelClassName="w-56"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isCurrent(pathname, link) ? 'page' : undefined}
            className={cn(
              POPOVER_ITEM,
              isCurrent(pathname, link) && 'bg-accent/8 text-accent',
            )}
          >
            {link.label}
          </Link>
        ))}
        {signIn ? (
          <Link href="/login" className={POPOVER_ITEM}>
            Sign in
          </Link>
        ) : null}
        <InstallMenuItem />
      </Popover>
    </div>
  );
}
