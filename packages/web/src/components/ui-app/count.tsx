import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';
import { formatCompact, formatCount } from '@/lib/intl';

/**
 * A number, grouped in thousands and kept in step with the digits around it;
 * `compact` shortens it ("1.2K") and reads out the whole number.
 */
export function Count({
  value,
  compact = false,
  className: cssClasses,
}: Readonly<{
  value: number;
  compact?: boolean;
  // eslint-disable-next-line unicorn/no-keyword-prefix -- React prop name
  className?: string;
}>): ReactElement {
  return (
    <span className={cn('tabular-nums', cssClasses)}>
      {compact ? (
        <>
          <span aria-hidden="true">{formatCompact(value)}</span>
          <span className="sr-only">{formatCount(value)}</span>
        </>
      ) : (
        formatCount(value)
      )}
    </span>
  );
}
