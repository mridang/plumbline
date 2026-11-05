'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';

import { problemText } from '@/components/api/problem-message';
import { saveReport } from '@/components/scan/report-body';
import { ScanResults, type Scan } from '@/components/scan/scan-results';
import type { IssueRef } from '@/domain/db/issue-history';
import { ScanStatus, isRunning, useScan } from '@/components/scan/scanner';
import { Button } from '@/components/ui/button';
import {
  MANUAL_RUN_INTERVAL_SECONDS,
  formatCountdown,
  nextRunAt,
  secondsLeft,
} from '@/domain/scan/manual-run';
import { countOf } from '@/lib/intl';

/** Whether the finished scan has been saved yet. */
type Saving =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved' }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * What a site's tab is built around: the line that names the site, the page's
 * own actions and "Run checks" on the right, and under them the report. Running
 * the checks shows them as they come in the report's place, then saves the
 * report and reads the page again so it joins the site's runs; otherwise
 * `saved` (drawn by the server) is shown. A site may be run by hand once every
 * five minutes: the button says when it can be again.
 */
export function SiteRunner({
  domainId,
  host,
  checks,
  repository,
  issuesByCheck,
  lastRunAt,
  identity,
  actions,
  saved,
}: Readonly<{
  domainId: string;
  host: string;
  checks: readonly string[];
  /** When the checks were last run by hand, when they were. */
  lastRunAt?: string | undefined;
  /** `owner/name` of the repository that serves the domain, when known. */
  repository?: string | undefined;
  /** The GitHub issues that report each check, by check id. */
  issuesByCheck?: Readonly<Record<string, readonly IssueRef[]>>;
  /** The line that names the site: its address, how it stands, when it was checked. */
  identity: ReactNode;
  /** Other things to do with the site, beside Run checks. */
  actions?: ReactNode;
  /** What is shown when no run is under way: the report, drawn by the server. */
  saved?: ReactNode;
}>): ReactElement {
  const router = useRouter();
  const [saving, setSaving] = useState<Saving>({ kind: 'idle' });
  // The moment the site may be run again: after the last run the server knows
  // of, or after the one this page has just saved, whichever is later. `now`
  // moves on every second while there is a wait.
  const [savedUntil, setSavedUntil] = useState(0);
  const until = Math.max(savedUntil, nextRunAt(lastRunAt));
  const [now, setNow] = useState(() => Date.now());
  const wait = secondsLeft(until, now);
  useEffect(() => {
    if (until <= Date.now()) {
      return undefined;
    }
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  const save = (scan: Scan): void => {
    setSaving({ kind: 'saving' });
    saveReport(domainId, scan).then(
      () => {
        setSaving({ kind: 'saved' });
        setSavedUntil(Date.now() + MANUAL_RUN_INTERVAL_SECONDS * 1000);
        router.refresh();
      },
      (error: unknown) =>
        setSaving({
          kind: 'failed',
          message: problemText(error, 'The report could not be saved.'),
        }),
    );
  };
  const { state, run } = useScan({ only: checks, onFinished: save });
  const running = isRunning(state);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">{identity}</div>
        <div className="flex flex-wrap items-center gap-2">
          <p aria-live="polite" className="text-sm text-muted">
            {saving.kind === 'saving' ? 'Saving the report…' : null}
            {saving.kind === 'saved' ? 'Report saved.' : null}
          </p>
          {actions}
          <Button
            variant="accent"
            disabled={running || checks.length === 0 || wait > 0}
            onClick={() => {
              setSaving({ kind: 'idle' });
              void run(host);
            }}
          >
            {running ? (
              'Running…'
            ) : wait > 0 ? (
              <span suppressHydrationWarning>
                Run again in {formatCountdown(wait)}
              </span>
            ) : (
              `Run ${countOf(checks.length, 'check')}`
            )}
          </Button>
        </div>
      </div>
      {saving.kind === 'failed' ? (
        <p role="alert" className="text-failed">
          {saving.message}
        </p>
      ) : null}
      <ScanStatus state={state} className="empty:hidden" />
      {state.kind === 'scanning' ? (
        <ScanResults
          scan={state.scan}
          repository={repository}
          issuesByCheck={issuesByCheck}
        />
      ) : (
        saved
      )}
    </div>
  );
}
