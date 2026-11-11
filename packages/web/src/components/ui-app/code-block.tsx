import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';

/**
 * A few lines of code or configuration. It scrolls sideways inside its own box
 * rather than widening the page, and can be focused so a keyboard can scroll it.
 */
export function CodeBlock({
  children,
  label,
  className,
}: Readonly<{
  children: string;
  /** What the block is, for people who hear the page. */
  label: string;
  className?: string;
}>): ReactElement {
  return (
    <pre
      role="region"
      aria-label={label}
      className={cn(
        'rounded-control border border-line bg-night px-4 py-3 font-mono text-[0.8125rem] leading-relaxed wrap-break-word whitespace-pre-wrap text-on-night',
        className,
      )}
    >
      <code>{children}</code>
    </pre>
  );
}
