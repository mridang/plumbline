import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';
import { formatCompact, formatCount } from '@/lib/intl';

/**
 * A number, grouped in thousands and kept in step with the digits around it;
 * `compact` shortens it ("1.2K") and keeps the whole number in its tooltip.
 */
export function Count({
  value,
  compact = false,
  className,
}: Readonly<{
  value: number;
  compact?: boolean;
  className?: string;
}>): ReactElement {
  return (
    // eslint-disable-next-line github/a11y-no-title-attribute -- the native tooltip showing the full number is the intended UX and a test asserts it
    <span
      title={compact ? formatCount(value) : undefined}
      className={cn('tabular-nums', className)}
    >
      {compact ? formatCompact(value) : formatCount(value)}
    </span>
  );
}
