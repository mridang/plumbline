import type { ReactElement, ReactNode } from 'react';

import { connectionState } from '@/domain/db/account-state';
import { getDatabase } from '@/domain/db/client';
import { getCurrentUser } from '@/lib/core/auth';

import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { SkipLink } from '@/components/site/skip-link';

/**
 * The frame shared by every page in `(site)`: the skip link, the header (which
 * shows who is signed in), the page in `<main id="main">` (where the skip link
 * jumps), and the footer.
 */
export async function SiteShell({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  const user = await getCurrentUser();
  const state = user
    ? await connectionState(getDatabase(), user.id)
    : undefined;
  return (
    <>
      <SkipLink />
      <SiteHeader user={user} {...(state ? { state } : {})} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
