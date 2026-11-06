'use client';

import { useState, type ReactElement, type ReactNode } from 'react';

import { SegmentedControl } from '@/components/ui-app/segmented-control';
import { Stat } from '@/components/ui-app/stat';
import type { Tone } from '@/components/ui-app/tone';
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
import { countOf, formatElapsed, formatTimestamp } from '@/lib/intl';

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
const COUNT_TONE: Readonly<Record<Status, Tone>> = {
  failed: 'bad',
  warned: 'warn',
  passed: 'good',
  skipped: 'neutral',
};

/** The line under the heading: the status, and how far along or how long it took. */
export function progressLine(scan: Readonly<Scan>): string {
  if (scan.savedAt !== undefined) {
    // Written out the same on the server and in the browser, whatever the time zone.
    return `${countOf(scan.total, 'check')} · scanned ${formatTimestamp(scan.savedAt)} UTC`;
  }
  const status = scan.status === undefined ? '' : `HTTP ${scan.status} · `;
  return scan.finishedAt === undefined
    ? `${status}${scan.hints.length} of ${countOf(scan.total, 'check')} done…`
    : `${status}${countOf(scan.total, 'check')} in ${formatElapsed(scan.finishedAt - scan.startedAt)}`;
}

/** The summary, the filter and the list of checks. */
export function ScanResults({
  scan,
  repository,
  issuesByCheck = {},
  now,
  between,
}: Readonly<{
  scan: Scan;
  /** Drawn between the totals and the list: where a page puts its choice of report. */
  between?: ReactNode;
  /** The server's clock when the page was made, in milliseconds, for the times shown. */
  now?: number;
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
    <section aria-labelledby="results" className="space-y-5">
      <div>
        <h2
          id="results"
          className="text-lg font-semibold text-balance break-all"
        >
          Results for{' '}
          <a
            href={scan.finalUrl}
            className="focus-ring underline underline-offset-4"
          >
            {scan.finalUrl}
          </a>
        </h2>
        <p className="mt-0.5 text-sm text-subtle">{progressLine(scan)}</p>
        {scan.finishedAt === undefined ? (
          <progress
            className="mt-3 h-1.5 w-full accent-brand"
            max={scan.total}
            value={scan.hints.length}
            aria-label="Checks done"
          />
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <Stat
            key={status}
            label={STATUS_LABELS[status]}
            value={counts[status]}
            tone={counts[status] === 0 ? 'neutral' : COUNT_TONE[status]}
          />
        ))}
      </dl>
      {between}
      <div className="sticky top-16 z-10 -mx-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-paper/90 px-1 py-2 backdrop-blur">
        <SegmentedControl
          label="Show"
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
          options={filters}
        />
        {shown.length > 0 ? (
          <button
            type="button"
            aria-controls="check-list"
            onClick={() =>
              setOverrides((before) => ({
                ...before,
                ...setAll(shown, !everyOneOpen),
              }))
            }
            className="focus-ring h-8 rounded-control border border-field bg-surface px-3 text-sm font-medium hover:border-ink motion-safe:transition"
          >
            {everyOneOpen ? 'Collapse all' : 'Expand all'}
          </button>
        ) : null}
      </div>
      <div id="check-list">
        {sections.length === 0 ? (
          <p className="py-8 text-center text-muted">Nothing to show here.</p>
        ) : (
          sections.map((section) => (
            <section
              key={section.id}
              aria-labelledby={`section-${section.id}`}
              className="mt-6 first:mt-0"
            >
              <h3
                id={`section-${section.id}`}
                className="text-label font-semibold text-subtle uppercase"
              >
                {section.title}
              </h3>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-xs">
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
                      now={now}
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
