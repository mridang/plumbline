import type { ReactElement } from 'react';

import { BRAND_NAME } from '@/app/_brand';
import { cn } from '@/components/ui/cn';

/** A plumb bob on its line: the app's mark, in the brand colour. */
export function BrandMark({
  className,
}: Readonly<{ className?: string }>): ReactElement {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={cn('text-brand', className)}
    >
      <rect x="15" y="2" width="2" height="12" rx="1" />
      <path d="M16 12 L24 20 L16 30 L8 20 Z" />
    </svg>
  );
}

/** The mark and the name, linking home. */
export function Logo(): ReactElement {
  return (
    <a
      href="/"
      className="focus-ring flex items-center gap-2 font-semibold tracking-tight"
    >
      <BrandMark className="size-6" />
      {BRAND_NAME}
    </a>
  );
}
