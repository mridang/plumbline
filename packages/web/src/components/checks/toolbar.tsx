import Link from 'next/link';
import type { ReactElement } from 'react';

import { BTN_GHOST } from '@/components/checks/parts';
import { SearchIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';
import { TIERS } from '@/domain/checks/catalogue';
import { queryOf, type View } from '@/domain/checks/browse';
import { countOf } from '@/lib/intl';

/** The class of a segment of the tier switch. */
function segment(on: boolean): string {
  return cn(
    'focus-ring-flush inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-3 text-sm font-medium whitespace-nowrap motion-safe:transition',
    on
      ? 'bg-surface text-ink shadow-xs ring-1 ring-line'
      : 'text-muted hover:text-ink',
  );
}

/**
 * The text filter and the tier switch above a list of rules. Both are plain
 * links and a plain GET form, so they work without a script; the form keeps
 * the tier and drops the open rule.
 */
export function Toolbar({
  path,
  view,
  shown,
  total,
  showTier,
  folds = false,
}: Readonly<{
  path: string;
  view: View;
  shown: number;
  total: number;
  /** The tier switch is left out when every rule has the same tier. */
  showTier: boolean;
  /** Offer Expand all and Collapse all for a list grouped in folds. */
  folds?: boolean;
}>): ReactElement {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <form
        action={path}
        method="get"
        role="search"
        className="relative block min-w-0 flex-1 basis-56 sm:max-w-xs"
      >
        <label>
          <span className="sr-only">Filter rules</span>
          <SearchIcon
            size="sm"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
          />
          <input
            type="search"
            name="q"
            defaultValue={view.q}
            placeholder="Filter rules"
            className="focus-ring-flush h-9 w-full rounded-control border border-line bg-surface pr-3 pl-9 text-sm placeholder:text-subtle"
          />
        </label>
        {view.tier ? (
          <input type="hidden" name="tier" value={view.tier} />
        ) : null}
      </form>
      {showTier ? (
        <div
          className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-control bg-ink/6 p-0.5"
          role="group"
          aria-label="Tier"
        >
          {[undefined, ...TIERS].map((tier) => (
            <Link
              key={tier ?? 'all'}
              href={`${path}${queryOf(view, { tier, rule: undefined })}`}
              aria-current={view.tier === tier ? 'true' : undefined}
              className={segment(view.tier === tier)}
            >
              {tier ? `${tier[0]?.toUpperCase()}${tier.slice(1)}` : 'All'}
            </Link>
          ))}
        </div>
      ) : null}
      <span className="text-sm text-subtle tabular-nums">
        {shown === total
          ? countOf(total, 'rule')
          : `${shown} of ${countOf(total, 'rule')}`}
      </span>
      {folds ? (
        <div className="ml-auto flex gap-1">
          <Link
            href={`${path}${queryOf(view, { open: 'all' })}`}
            className={BTN_GHOST}
          >
            Expand all
          </Link>
          <Link
            href={`${path}${queryOf(view, { open: 'none' })}`}
            className={BTN_GHOST}
          >
            Collapse all
          </Link>
        </div>
      ) : null}
    </div>
  );
}
