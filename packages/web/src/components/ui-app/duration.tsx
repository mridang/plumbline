import type { ReactElement } from 'react';

import { formatElapsed } from '@/lib/intl';

/** How long something took, from milliseconds: "21.1s", "1m 5s". */
export function Duration({
  ms,
  className,
}: Readonly<{ ms: number; className?: string }>): ReactElement {
  return (
    // eslint-disable-next-line github/a11y-no-title-attribute -- the native tooltip showing exact milliseconds is the intended UX and a test asserts it
    <span className={className} title={`${ms} milliseconds`}>
      {formatElapsed(ms)}
    </span>
  );
}
