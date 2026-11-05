'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';

import { problemText } from '@/components/api/problem-message';
import { saveReport } from '@/components/scan/report-body';
import { ScanResults, type Scan } from '@/components/scan/scan-results';
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
 * "Run checks" for one site: runs the checks chosen for it on the server,
 * shows them as they come, then saves the report and reloads the page so it
 * appears in the site's runs.
 */
export function RunChecks({
  domainId,
  host,
  checks,
  repository,
  lastRunAt,
}: Readonly<{
  domainId: string;
  host: string;
  checks: readonly string[];
  /** When the checks were last run by hand, when they were; a site may be run by hand once every five minutes. */
  lastRunAt?: string | undefined;
  /** `owner/name` of the repository that serves the domain, when known. */
  repository?: string;
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
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          size="lg"
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
        <p aria-live="polite" className="text-sm text-muted">
          {saving.kind === 'saving' ? 'Saving the report…' : null}
          {saving.kind === 'saved' ? 'Report saved.' : null}
        </p>
      </div>
      {saving.kind === 'failed' ? (
        <p role="alert" className="mt-3 text-failed">
          {saving.message}
        </p>
      ) : null}
      <ScanStatus state={state} />
      {state.kind === 'scanning' ? (
        <ScanResults scan={state.scan} repository={repository} />
      ) : null}
    </div>
  );
}
