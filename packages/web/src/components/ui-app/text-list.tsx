import type { ReactElement } from 'react';

import { listAnd, listOr } from '@/lib/intl';

/** Items in a sentence: "a, b and c", or "a, b or c". */
export function TextList({
  items,
  or = false,
}: Readonly<{
  items: readonly string[];
  /** Join the last two with "or" instead of "and". */
  or?: boolean;
}>): ReactElement {
  return <>{or ? listOr(items) : listAnd(items)}</>;
}
