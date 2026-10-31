import type { ReactElement, ReactNode } from 'react';

import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { SkipLink } from '@/components/site/skip-link';

/**
 * The frame shared by every page in `(site)`: the skip link, the header, the
 * page in `<main id="main">` (where the skip link jumps), and the footer. There
 * are no accounts, so the header is the same for everyone.
 */
export function SiteShell({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <>
      <SkipLink />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
