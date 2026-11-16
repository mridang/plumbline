import type { ReactElement } from 'react';

import { formatElapsed } from '@/lib/intl';

/** How long something took, from milliseconds: "21.1s", "1m 5s". */
export function Duration({
  ms,
  className: cssClasses,
}: Readonly<{
  ms: number;
  // eslint-disable-next-line unicorn/no-keyword-prefix -- React prop name
  className?: string;
}>): ReactElement {
  return (
    <span className={cssClasses}>
      {formatElapsed(ms)}
      <span className="sr-only"> ({ms} milliseconds)</span>
    </span>
  );
}
