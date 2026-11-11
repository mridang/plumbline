import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { Chevron } from '@/components/checks/parts';
import { cn } from '@/components/ui/cn';
import {
  CHECKS,
  DISPLAY_GROUPS,
  PROFILES,
  SECTIONS,
  SET_INFOS,
} from '@/domain/checks/catalogue';
import { OVERVIEW_PATH, areaPath, setPath } from '@/domain/checks/browse';
import { findRuleSet } from '@/domain/checks/sets';
import { STOCK_HINTS } from '@/domain/checks/stock';
import { formatCount } from '@/lib/intl';

/** The page the visitor is on, so the sidebar can mark it and open its fold. */
export type Here =
  | { readonly kind: 'overview' }
  | { readonly kind: 'set'; readonly id: string }
  | { readonly kind: 'area'; readonly id: string }
  | { readonly kind: 'tags' }
  | { readonly kind: 'webhint' };

/** The top-level sets, in order. */
const TOP = SET_INFOS.filter((set) => set.kind === 'top').map((set) => set.id);

/** The words the sidebar uses for a set. */
export function setTitle(id: string): string {
  const title = findRuleSet(id)?.title ?? id;
  return id === 'plumbline:all' ? 'All rules' : title;
}

/** One link of the sidebar. */
function Item({
  href,
  current,
  count,
  children,
}: Readonly<{
  href: string;
  current: boolean;
  count?: number;
  children: ReactNode;
}>): ReactElement {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'focus-ring-flush flex items-center justify-between gap-3 rounded-control px-3 py-1.5 text-sm',
        current
          ? 'bg-ink/6 font-semibold text-ink'
          : 'text-muted hover:bg-ink/4 hover:text-ink',
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {count === undefined ? null : (
        <span className="shrink-0 text-xs text-subtle tabular-nums">
          {formatCount(count)}
        </span>
      )}
    </Link>
  );
}

/** A small heading in the sidebar. */
function Head({ children }: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <p className="mt-6 mb-1.5 px-3 text-label font-semibold tracking-[0.16em] text-subtle uppercase">
      {children}
    </p>
  );
}

/** A fold of links that opens without a script. */
function Fold({
  title,
  open,
  count,
  children,
}: Readonly<{
  title: string;
  open: boolean;
  count?: number;
  children: ReactNode;
}>): ReactElement {
  return (
    <details className="group/f" open={open}>
      <summary className="focus-ring-flush flex cursor-pointer list-none items-center justify-between gap-2 rounded-control px-3 py-1.5 text-sm text-muted hover:bg-ink/4 hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Chevron className="group-open/f:rotate-90" />
          {title}
        </span>
        {count === undefined ? null : (
          <span className="text-xs text-subtle tabular-nums">{count}</span>
        )}
      </summary>
      <div className="mt-0.5 ml-5 border-l border-line pl-1">{children}</div>
    </details>
  );
}

/**
 * The sidebar: the rule sets, a fold of add-ons and audiences, the areas in
 * folds (the one of the current page open), and the references.
 */
export function SideNav({ here }: Readonly<{ here: Here }>): ReactElement {
  const count = (id: string): number => findRuleSet(id)?.members.length ?? 0;
  const isSet = (id: string): boolean => here.kind === 'set' && here.id === id;
  const setItem = (id: string): ReactElement => (
    <Item key={id} href={setPath(id)} current={isSet(id)} count={count(id)}>
      {setTitle(id)}
    </Item>
  );
  const addons = SECTIONS.filter((section) => !section.default_on)
    .map((section) => `plumbline:${section.id}/recommended`)
    .filter((id) => findRuleSet(id));
  const audiences = PROFILES.map((profile) => profile.id);
  const folded = [...addons, ...audiences];
  return (
    <nav aria-label="Rules">
      <Item href={OVERVIEW_PATH} current={here.kind === 'overview'}>
        Overview
      </Item>
      <Head>Rule sets</Head>
      {TOP.map((id) => setItem(id))}
      {folded.length > 0 ? (
        <Fold
          title="Add-ons and audiences"
          open={folded.some((id) => isSet(id))}
          count={folded.length}
        >
          {folded.map((id) => setItem(id))}
        </Fold>
      ) : null}
      <Head>Rules by area</Head>
      {DISPLAY_GROUPS.map((group) => (
        <Fold
          key={group.id}
          title={group.title}
          open={here.kind === 'area' && group.sections.includes(here.id)}
        >
          {group.sections.map((id) => (
            <Item
              key={id}
              href={areaPath(id)}
              current={here.kind === 'area' && here.id === id}
              count={CHECKS.filter((check) => check.section === id).length}
            >
              {SECTIONS.find((section) => section.id === id)?.title ?? id}
            </Item>
          ))}
        </Fold>
      ))}
      <Head>Reference</Head>
      <Item href={`${OVERVIEW_PATH}/tags`} current={here.kind === 'tags'}>
        Goals and tags
      </Item>
      <Item
        href={`${OVERVIEW_PATH}/webhint`}
        current={here.kind === 'webhint'}
        count={STOCK_HINTS.length}
      >
        Webhint stock hints
      </Item>
    </nav>
  );
}
