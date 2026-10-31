import type { ReactElement } from 'react';

import { Container } from '@/components/ui/layout';
import { SOURCE_URL } from '@/utils/site';

import { InstallButton } from '@/components/site/install-button';
import { Logo } from '@/components/site/logo';

/** The bar at the top of every page: the mark, and the way to the source. */
export function SiteHeader(): ReactElement {
  return (
    <header className="border-b border-line bg-surface">
      <Container className="flex h-14 items-center justify-between gap-4">
        <Logo />
        <div className="flex items-center gap-4">
          <InstallButton />
          <a
            href={SOURCE_URL}
            className="focus-ring text-sm text-muted hover:text-ink"
          >
            Source on GitHub
          </a>
        </div>
      </Container>
    </header>
  );
}
