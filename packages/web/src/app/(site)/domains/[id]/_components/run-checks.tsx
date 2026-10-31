'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { problemText } from '@/components/api/problem-message';
import { saveReport } from '@/components/scan/report-body';
import { ScanResults, type Scan } from '@/components/scan/scan-results';
import { ScanStatus, isRunning, useScan } from '@/components/scan/scanner';
import { Button } from '@/components/ui/button';

/** Whether the finished scan has been saved yet. */
type Saving =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved' }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * "Run checks" for one domain: runs the checks chosen for it in the browser,
 * shows them as they come, then saves the report and reloads the page so it
 * appears among the saved ones.
 */
export function RunChecks({
  domainId,
  host,
  checks,
}: Readonly<{
  domainId: string;
  host: string;
  checks: readonly string[];
}>): ReactElement {
  const router = useRouter();
  const [saving, setSaving] = useState<Saving>({ kind: 'idle' });
  const save = (scan: Scan): void => {
    setSaving({ kind: 'saving' });
    saveReport(domainId, scan).then(
      () => {
        setSaving({ kind: 'saved' });
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
          disabled={running || checks.length === 0}
          onClick={() => {
            setSaving({ kind: 'idle' });
            void run(host);
          }}
        >
          {running ? 'Running…' : `Run ${checks.length} checks`}
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
      {state.kind === 'scanning' ? <ScanResults scan={state.scan} /> : null}
    </div>
  );
}
