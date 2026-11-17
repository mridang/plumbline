import { cn } from '@/components/ui/cn';
import type { ReactElement } from 'react';

/**
 * A few lines of code or configuration. It scrolls sideways inside its own box
 * rather than widening the page, and can be focused so a keyboard can scroll it.
 */
export function CodeBlock({
  children,
  label,
  className: cssClasses,
}: Readonly<{
  children: string;
  /** What the block is, for people who hear the page. */
  label: string;
  // eslint-disable-next-line unicorn/no-keyword-prefix -- React prop name
  className?: string;
}>): ReactElement {
  return (
    <section aria-label={label}>
      <pre
        className={cn(
          'rounded-control border border-line bg-night px-4 py-3 font-mono text-[0.8125rem] leading-relaxed wrap-break-word whitespace-pre-wrap text-on-night',
          cssClasses,
        )}
      >
        <code>{children}</code>
      </pre>
    </section>
  );
}
