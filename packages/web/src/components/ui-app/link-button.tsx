import Link from 'next/link';
import type { ComponentProps, ReactElement, ReactNode } from 'react';

import { buttonClass } from '@/components/ui/button';

type Look = Parameters<typeof buttonClass>[0];

/**
 * A link that looks like a button. Inside the app it is a client-side link;
 * `native` makes it an ordinary link (for an address the server answers with a
 * redirect, such as signing in with GitHub), and `external` an ordinary link
 * that opens a new tab and says so.
 */
export function LinkButton({
  href,
  external = false,
  native = false,
  variant,
  size,
  className,
  children,
  ...rest
}: Readonly<
  {
    href: string;
    external?: boolean;
    native?: boolean;
    children: ReactNode;
  } & Look &
    Omit<ComponentProps<'a'>, 'href' | 'children' | 'className'>
>): ReactElement {
  const classes = buttonClass({ variant, size, className });
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        {...rest}
      >
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  if (native) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...rest}>
      {children}
    </Link>
  );
}
