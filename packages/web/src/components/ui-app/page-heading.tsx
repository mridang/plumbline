import type { ReactElement, ReactNode } from 'react';

import { Container, Eyebrow } from '@/components/ui/layout';

/**
 * The top of a working page: a small eyebrow, the page's one `h1`, a line that
 * says what the page is for, and the page's main controls on the right. Compact
 * on purpose: the work starts a few lines down, not a screen down. `children`
 * sit under it (a row of totals).
 */
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  children,
}: Readonly<{
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}>): ReactElement {
  return (
    <div className="border-b border-line bg-surface">
      <Container className="py-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <h1
              className={`font-display text-2xl leading-tight font-semibold text-balance sm:text-3xl ${eyebrow ? 'mt-1.5' : ''}`}
            >
              {title}
            </h1>
            {description ? (
              <p className="mt-1.5 max-w-2xl text-sm text-pretty text-muted sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
      </Container>
    </div>
  );
}
