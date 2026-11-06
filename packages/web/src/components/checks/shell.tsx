import type { ReactElement, ReactNode } from 'react';

import { Container } from '@/components/ui/layout';

import { SideNav, type Here } from './side-nav';

/**
 * The frame of every rules page: the sidebar to the left (a folded menu on a
 * phone, which needs no script) and the page to the right.
 */
export function ChecksShell({
  here,
  children,
}: Readonly<{ here: Here; children: ReactNode }>): ReactElement {
  return (
    <Container className="grid gap-6 pt-8 pb-20 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto">
        <details className="rounded-card border border-line bg-surface lg:hidden">
          <summary className="focus-ring-flush cursor-pointer list-none rounded-card px-4 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Browse the rules
          </summary>
          <div className="border-t border-line p-2">
            <SideNav here={here} />
          </div>
        </details>
        <div className="hidden lg:block">
          <SideNav here={here} />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </Container>
  );
}
