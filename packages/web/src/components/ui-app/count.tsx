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
    <span
      title={compact ? formatCount(value) : undefined}
      className={cn('tabular-nums', className)}
    >
      {compact ? formatCompact(value) : formatCount(value)}
    </span>
  );
}
