'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { problemText } from '@/components/api/problem-message';
import { setRepoChecks } from '@/components/repos/repo-checks';
import { cn } from '@/components/ui/cn';
import { POPOVER_ITEM } from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/site/confirm-dialog';

/** What turning checks off means, said plainly before it is done. */
export const PAUSE_WARNING =
  'Webhooks and scheduled checks for this repository stop, and its open Plumbline issues are closed with a note saying why. Turning checks back on resumes them with the next deployment or schedule.';

/**
 * Turning checks on or off for a repository: `request` turns them on at once
 * and asks first before turning them off. `dialog` is the question, to be
 * drawn next to (not inside) whatever started it, since a menu unmounts its
 * contents when it closes. `problem` is what the server said when it refused.
 */
export function useRepoChecks(
  repo: string | null,
  paused: boolean,
): {
  request: () => void;
  dialog: ReactElement | null;
  problem: string | null;
} {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const apply = (on: boolean): void => {
    if (repo === null) {
      return;
    }
    setProblem(null);
    setRepoChecks(repo, on).then(
      () => router.refresh(),
      (error: unknown) =>
        setProblem(problemText(error, 'Could not change that.')),
    );
  };
  return {
    request: () => (paused ? apply(true) : setAsking(true)),
    problem,
    dialog:
      repo === null ? null : (
        <ConfirmDialog
          open={asking}
          onOpenChange={setAsking}
          title={`Turn off checks for ${repo}?`}
          description={PAUSE_WARNING}
          confirmLabel="Turn off checks"
          onConfirm={() => apply(false)}
        />
      ),
  };
}

/** The entry of a row's menu that turns checks off or on. */
export function ChecksMenuItem({
  paused,
  onRequest,
}: Readonly<{ paused: boolean; onRequest: () => void }>): ReactElement {
  return (
    <button type="button" className={POPOVER_ITEM} onClick={onRequest}>
      {paused ? 'Turn checks on' : 'Turn checks off'}
    </button>
  );
}

/**
 * A small on/off switch for the repository's checks, for the repository's page:
 * on means webhooks and the schedule check it. Turning it off asks first.
 */
export function ChecksSwitch({
  repo,
  paused,
}: Readonly<{ repo: string; paused: boolean }>): ReactElement {
  const { request, dialog, problem } = useRepoChecks(repo, paused);
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={!paused}
        aria-label={`Checks for ${repo}`}
        onClick={request}
        className="focus-ring inline-flex items-center gap-2 rounded-full text-sm font-medium text-muted hover:text-ink"
      >
        <span
          aria-hidden="true"
          className={cn(
            'relative inline-block h-5 w-9 rounded-full motion-safe:transition-colors',
            paused ? 'bg-ink/20' : 'bg-accent',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 size-4 rounded-full bg-surface shadow-xs motion-safe:transition-transform',
              paused ? 'translate-x-0' : 'translate-x-4',
            )}
          />
        </span>
        {paused ? 'Checks paused' : 'Checks on'}
      </button>
      {problem ? (
        <p role="alert" className="text-xs text-failed">
          {problem}
        </p>
      ) : null}
      {dialog}
    </>
  );
}
