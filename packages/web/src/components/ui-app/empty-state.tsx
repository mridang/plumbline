import type { ReactElement, ReactNode } from 'react';

/** What a list or table says when it has nothing yet, and what to do about it. */
export function EmptyState({
  title,
  action,
  children,
}: Readonly<{
  title: string;
  /** The one thing to do next, as a button or link. */
  action?: ReactNode;
  children?: ReactNode;
}>): ReactElement {
  return (
    <div className="rounded-card border border-dashed border-field/60 bg-surface px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold text-balance">{title}</p>
      {children ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-pretty text-muted">
          {children}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
