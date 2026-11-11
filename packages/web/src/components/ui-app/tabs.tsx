'use client';

import Link from 'next/link';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/** One tab: its place in the address (`key`), what it says and where it leads. */
export interface TabItem {
  readonly key: string;
  readonly label: ReactNode;
  readonly href: string;
}

/** The id of a tab's button, for the panel it opens to be named by it. */
export function tabId(panelId: string, key: string): string {
  return `${panelId}-tab-${key}`;
}

/** The index a key moves focus to, or -1 for a key that moves nothing. */
function nextTabIndex(key: string, at: number, last: number): number {
  if (key === 'ArrowRight') {
    return at >= last ? 0 : at + 1;
  }
  if (key === 'ArrowLeft') {
    return at <= 0 ? last : at - 1;
  }
  if (key === 'Home') {
    return 0;
  }
  if (key === 'End') {
    return last;
  }
  return -1;
}

/**
 * Move focus to the tab the key points at: arrows step along (and wrap), Home
 * and End go to the ends. The tab in force is the only one in the tab order, so
 * the tabs are one stop for Tab and the arrows are how you move among them. A
 * tab is a link, so Enter (or a click) is what opens it: the address changes
 * and the server draws its panel.
 */
export function moveFocus(
  event: KeyboardEvent<HTMLElement>,
  tabs: readonly HTMLElement[],
): void {
  const at = tabs.indexOf(document.activeElement as HTMLElement);
  const last = tabs.length - 1;
  const target = nextTabIndex(event.key, at, last);
  if (target >= 0) {
    event.preventDefault();
    tabs[target]?.focus();
  }
}

/**
 * A tab list whose tabs are places: each is a link, the one in force is
 * `aria-selected`, and `panelId` is the panel it controls (draw it with
 * {@link TabPanel}). Linkable and drawn by the server, with the keyboard
 * behaviour of the ARIA tabs pattern.
 */
export function TabList({
  label,
  panelId,
  tabs,
  current,
}: Readonly<{
  label: string;
  panelId: string;
  tabs: readonly TabItem[];
  current: string;
}>): ReactElement {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mb-px flex gap-1 overflow-x-auto border-b border-line"
    >
      {tabs.map((tab) => {
        const selected = tab.key === current;
        return (
          <Link
            key={tab.key}
            id={tabId(panelId, tab.key)}
            role="tab"
            href={tab.href}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(event) =>
              moveFocus(event, [
                ...(event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
                  '[role=tab]',
                ) ?? []),
              ])
            }
            className={cn(
              'focus-ring-flush -mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap motion-safe:transition-colors',
              selected
                ? 'border-ink text-ink'
                : 'border-transparent text-muted hover:border-ink/25 hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

/** What a tab opens, named by it. */
export function TabPanel({
  panelId,
  current,
  children,
}: Readonly<{
  panelId: string;
  current: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId(panelId, current)}
      tabIndex={-1}
      className="pt-5"
    >
      {children}
    </div>
  );
}
