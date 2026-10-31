'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import type { HintOutcome } from '@/domain/scan/engine';
import { problemText } from '@/components/api/problem-message';
import { runScan } from '@/domain/scan/pool';

import {
  countByStatus,
  sectionsOf,
  STATUS_LABELS,
  STATUS_ORDER,
  type Filter,
  type Status,
} from './results';

/** A scan under way or done: where the page ended up, and what has run. */
interface Scan {
  readonly finalUrl: string;
  readonly status: number;
  /** How many hints there are in all. */
  readonly total: number;
  readonly hints: readonly HintOutcome[];
  readonly startedAt: number;
  /** When the last hint finished; absent while hints are still running. */
  readonly finishedAt?: number;
}

/** Where the scan is. */
type State =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting'; readonly domain: string }
  | { readonly kind: 'scanning'; readonly scan: Scan }
  | { readonly kind: 'error'; readonly message: string };

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

/** The box to type a domain into, and what the scan found. */
export function Scanner(): ReactElement {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const input = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const scan = async (value: string): Promise<void> => {
    const trimmed = value.trim();
    if (trimmed === '') {
      return;
    }
    setState({ kind: 'starting', domain: trimmed });
    // The address carries the domain, so a result can be shared or reloaded.
    const url = new URL(window.location.href);
    url.searchParams.set('domain', trimmed);
    window.history.replaceState(null, '', url);
    const startedAt = Date.now();
    try {
      await runScan(trimmed, {
        onStart: ({ finalUrl, status, hints }) =>
          setState({
            kind: 'scanning',
            scan: {
              finalUrl,
              status,
              total: hints.length,
              hints: [],
              startedAt,
            },
          }),
        onOutcome: (outcome) =>
          setState((current) =>
            current.kind === 'scanning'
              ? {
                  kind: 'scanning',
                  scan: {
                    ...current.scan,
                    hints: [...current.scan.hints, outcome],
                  },
                }
              : current,
          ),
      });
      setState((current) =>
        current.kind === 'scanning'
          ? {
              kind: 'scanning',
              scan: { ...current.scan, finishedAt: Date.now() },
            }
          : current,
      );
    } catch (error) {
      setState({
        kind: 'error',
        message: problemText(
          error,
          'Could not reach the scanner. Check your connection.',
        ),
      });
    }
  };

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    const given = new URLSearchParams(window.location.search).get('domain');
    // A shared link starts its scan by submitting the form, as a click would.
    if (given && input.current) {
      input.current.value = given;
      input.current.form?.requestSubmit();
    }
  }, []);

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void scan(input.current?.value ?? '');
  };

  const running =
    state.kind === 'starting' ||
    (state.kind === 'scanning' && state.scan.finishedAt === undefined);
  return (
    <div className="mt-10">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 sm:flex-row"
        role="search"
      >
        <label htmlFor="domain" className="sr-only">
          Domain or URL
        </label>
        <input
          id="domain"
          name="domain"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="example.com"
          ref={input}
          className="focus-ring-flush h-12 w-full rounded-control border border-field bg-surface px-4 text-base sm:flex-1"
          required
        />
        <Button type="submit" size="lg" variant="accent" disabled={running}>
          {running ? 'Scanning…' : 'Scan'}
        </Button>
      </form>
      <div aria-live="polite" className="mt-8">
        {state.kind === 'starting' ? (
          <p className="text-muted">
            Fetching{' '}
            <span className="font-semibold text-ink">{state.domain}</span>…
          </p>
        ) : null}
        {state.kind === 'error' ? (
          <p
            role="alert"
            className="rounded-card border border-failed/30 bg-failed/5 px-4 py-3 text-failed"
          >
            {state.message}
          </p>
        ) : null}
      </div>
      {state.kind === 'scanning' ? <Results scan={state.scan} /> : null}
    </div>
  );
}

/** The summary, the filter and the list of checks. */
function Results({ scan }: Readonly<{ scan: Scan }>): ReactElement {
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
      <p className="mt-1 text-sm text-subtle">
        {scan.finishedAt === undefined
          ? `HTTP ${scan.status} · ${scan.hints.length} of ${scan.total} checks done…`
          : `HTTP ${scan.status} · ${scan.total} checks in ${((scan.finishedAt - scan.startedAt) / 1000).toFixed(1)} s`}
      </p>
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
