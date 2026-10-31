'use client';

import { useState, type ReactElement } from 'react';

import { cn } from '@/components/ui/cn';
import type { HintOutcome } from '@/domain/scan/engine';

import {
  countByStatus,
  sectionsOf,
  STATUS_LABELS,
  STATUS_ORDER,
  type Filter,
  type Status,
} from './results';

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

/** The colour of each outcome's badge. */
const BADGE: Readonly<Record<Status, string>> = {
  failed: 'bg-failed text-white',
  warned: 'bg-warned text-white',
  passed: 'bg-passed text-white',
  skipped: 'bg-skipped/15 text-skipped',
};

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
    return `${scan.total} checks · scanned ${scan.savedAt.slice(0, 16).replace('T', ' ')} UTC`;
  }
  const status = scan.status === undefined ? '' : `HTTP ${scan.status} · `;
  return scan.finishedAt === undefined
    ? `${status}${scan.hints.length} of ${scan.total} checks done…`
    : `${status}${scan.total} checks in ${((scan.finishedAt - scan.startedAt) / 1000).toFixed(1)} s`;
}

/** The summary, the filter and the list of checks. */
export function ScanResults({ scan }: Readonly<{ scan: Scan }>): ReactElement {
  const counts = countByStatus(scan.hints);
  const [filter, setFilter] = useState<Filter>(
    counts.failed + counts.warned > 0 ? 'problems' : 'all',
  );
  const sections = sectionsOf(scan.hints, filter);
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
                  <HintRow hint={hint} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}

/** One check: its outcome and name, and on opening what it found. */
function HintRow({ hint }: Readonly<{ hint: HintOutcome }>): ReactElement {
  return (
    <details className="group">
      <summary className="focus-ring-flush flex items-start gap-3 px-4 py-3 hover:bg-ink/3">
        <span
          className={cn(
            'mt-0.5 inline-flex w-20 shrink-0 justify-center rounded-full px-2 py-0.5 text-xs font-semibold',
            BADGE[hint.status],
          )}
        >
          {STATUS_LABELS[hint.status]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{hint.name}</span>
          {hint.findings.length > 0 ? (
            <span className="ml-2 text-sm text-subtle">
              {hint.findings.length}{' '}
              {hint.findings.length === 1 ? 'finding' : 'findings'}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4 pl-27 text-sm">
        <p className="text-muted">{hint.description}</p>
        {hint.reason ? <p className="text-skipped">{hint.reason}</p> : null}
        {hint.findings.length > 0 ? (
          <ul className="space-y-3">
            {hint.findings.map((finding, index) => (
              <li key={index}>
                <p>
                  <span className="font-semibold capitalize">
                    {finding.level}:
                  </span>{' '}
                  {finding.message}
                </p>
                <p className="mt-0.5 text-xs break-all text-subtle">
                  {finding.resource}
                  {finding.line ? `:${finding.line}` : ''}
                </p>
                {finding.snippet ? (
                  <pre className="mt-2 overflow-x-auto rounded-control bg-ink/5 p-3 font-mono text-xs whitespace-pre-wrap">
                    {finding.snippet}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {hint.reference ? (
          <p>
            <a
              href={hint.reference}
              className="focus-ring text-accent underline"
            >
              Where this rule comes from
            </a>
          </p>
        ) : null}
      </div>
    </details>
  );
}
