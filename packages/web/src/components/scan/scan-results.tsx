'use client';

import { useState, type ReactElement } from 'react';

import { cn } from '@/components/ui/cn';
import type { IssueRef } from '@/domain/db/issue-history';
import type { HintOutcome } from '@/domain/scan/outcome';

import { FixPromptBox } from './fix-prompt-box';
import { HintRow } from './hint-row';
import {
  allOpen,
  countByStatus,
  isOpen,
  sectionsOf,
  setAll,
  STATUS_LABELS,
  STATUS_ORDER,
  type Filter,
  type OpenOverrides,
  type Status,
} from './results';
import { countOf, formatRating } from '@/lib/intl';

/** A scan under way or done, or a saved one: where the page ended up, and what has run. */
export interface Scan {
  readonly finalUrl: string;
  /** The status the page answered with; unknown for a saved report. */
  readonly status?: number;
  /** How many hints there are in all. */
  readonly total: number;
  readonly hints: readonly HintOutcome[];
  readonly startedAt: number;
  /** When the last hint finished; absent while hints are still running. */
  readonly finishedAt?: number;
  /** When a saved report was made (RFC 3339); absent for a scan run here. */
  readonly savedAt?: string;
}

/** The colour of each outcome's count. */
const COUNT: Readonly<Record<Status, string>> = {
  failed: 'text-failed',
  warned: 'text-warned',
  passed: 'text-passed',
  skipped: 'text-skipped',
};

/** The line under the heading: the status, and how far along or how long it took. */
export function progressLine(scan: Readonly<Scan>): string {
  if (scan.savedAt !== undefined) {
    // Written out the same on the server and in the browser, whatever the time zone.
    return `${countOf(scan.total, 'check')} · scanned ${scan.savedAt.slice(0, 16).replace('T', ' ')} UTC`;
  }
  const status = scan.status === undefined ? '' : `HTTP ${scan.status} · `;
  return scan.finishedAt === undefined
    ? `${status}${scan.hints.length} of ${countOf(scan.total, 'check')} done…`
    : `${status}${countOf(scan.total, 'check')} in ${formatRating((scan.finishedAt - scan.startedAt) / 1000)} s`;
}

/** The summary, the filter and the list of checks. */
export function ScanResults({
  scan,
  repository,
  issuesByCheck = {},
}: Readonly<{
  scan: Scan;
  /** `owner/name` of the project that serves the site, when known. */
  repository?: string;
  /** The GitHub issues that report each check, by check id (see `issuesByCheck`). */
  issuesByCheck?: Readonly<Record<string, readonly IssueRef[]>>;
}>): ReactElement {
  const counts = countByStatus(scan.hints);
  const [filter, setFilter] = useState<Filter>(
    counts.failed + counts.warned > 0 ? 'problems' : 'all',
  );
  // What the person opened or closed by hand; the rest start as `openByDefault` says.
  const [overrides, setOverrides] = useState<OpenOverrides>({});
  const sections = sectionsOf(scan.hints, filter);
  const shown = sections.flatMap((section) => section.hints);
  const everyOneOpen = allOpen(shown, overrides);
  const filters: readonly { value: Filter; label: string; count: number }[] = [
    {
      value: 'problems',
      label: 'Problems',
      count: counts.failed + counts.warned,
    },
    ...STATUS_ORDER.map((status) => ({
      value: status,
      label: STATUS_LABELS[status],
      count: counts[status],
    })),
    { value: 'all', label: 'All', count: scan.hints.length },
  ];
  return (
    <section aria-labelledby="results" className="mt-2">
      <h2 id="results" className="text-xl font-semibold">
        Results for{' '}
        <a href={scan.finalUrl} className="focus-ring break-all underline">
          {scan.finalUrl}
        </a>
      </h2>
      <p className="mt-1 text-sm text-subtle">{progressLine(scan)}</p>
      {scan.finishedAt === undefined ? (
        <progress
          className="mt-3 h-1.5 w-full accent-brand"
          max={scan.total}
          value={scan.hints.length}
          aria-label="Checks done"
        />
      ) : null}
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <div
            key={status}
            className="rounded-card border border-line bg-surface px-4 py-3"
          >
            <dt className="text-label font-semibold text-subtle uppercase">
              {STATUS_LABELS[status]}
            </dt>
            <dd className={cn('mt-1 text-3xl font-semibold', COUNT[status])}>
              {counts[status]}
            </dd>
          </div>
        ))}
      </dl>
      <div role="group" aria-label="Show" className="mt-6 flex flex-wrap gap-2">
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              'focus-ring h-9 rounded-full border px-4 text-sm font-medium transition',
              filter === option.value
                ? 'border-ink bg-ink text-on-ink'
                : 'border-field bg-surface text-ink hover:border-ink',
            )}
          >
            {option.label}{' '}
            <span className="tabular-nums opacity-70">{option.count}</span>
          </button>
        ))}
      </div>
      {shown.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            aria-controls="check-list"
            onClick={() =>
              setOverrides((before) => ({
                ...before,
                ...setAll(shown, !everyOneOpen),
              }))
            }
            className="focus-ring h-9 rounded-full border border-field bg-surface px-4 text-sm font-medium transition hover:border-ink"
          >
            {everyOneOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      ) : null}
      <div id="check-list">
        {sections.length === 0 ? (
          <p className="mt-8 text-muted">Nothing to show here.</p>
        ) : (
          sections.map((section) => (
            <section
              key={section.id}
              aria-labelledby={`section-${section.id}`}
              className="mt-10"
            >
              <h3
                id={`section-${section.id}`}
                className="text-label font-semibold text-subtle uppercase"
              >
                {section.title}
              </h3>
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                {section.hints.map((hint) => (
                  <li key={hint.id}>
                    <HintRow
                      hint={hint}
                      open={isOpen(hint, overrides)}
                      onToggle={(open) =>
                        setOverrides((before) => ({
                          ...before,
                          [hint.id]: open,
                        }))
                      }
                      repository={repository}
                      issues={issuesByCheck[hint.id]}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      {scan.finishedAt !== undefined || scan.savedAt !== undefined ? (
        <FixPromptBox scan={scan} repository={repository} />
      ) : null}
    </section>
  );
}
