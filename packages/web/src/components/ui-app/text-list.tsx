import { listAnd, listOr } from '@/lib/intl';
import type { ReactNode } from 'react';

/** Items in a sentence: "a, b and c", or "a, b or c". */
export function TextList({
  items,
  or = false,
}: Readonly<{
  items: readonly string[];
  /** Join the last two with "or" instead of "and". */
  or?: boolean;
}>): ReactNode {
  // eslint-disable-next-line sonarjs/no-selector-parameter -- a component prop, it is how callers pick the joining word
  return or ? listOr(items) : listAnd(items);
}
