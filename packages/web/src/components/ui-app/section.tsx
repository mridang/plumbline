import type { ReactElement, ReactNode } from 'react';

/**
 * A titled part of a page: a heading, a line on what it holds, optional
 * actions to the right of the heading, then its content.
 */
export function Section({
  id,
  title,
  description,
  actions,
  as = 'h2',
  children,
}: Readonly<{
  id?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  as?: 'h2' | 'h3';
  children: ReactNode;
}>): ReactElement {
  const headingId = id ? `${id}-heading` : undefined;
  const Heading = as;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <Heading
            id={headingId}
            className="font-display text-xl leading-snug font-semibold tracking-tight"
          >
            {title}
          </Heading>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-balance text-muted">
              {description}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
