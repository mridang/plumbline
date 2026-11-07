'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type ReactElement } from 'react';

import { problemText } from '@/components/api/problem-message';
import {
  lockedReason,
  type ChecksControl,
} from '@/components/repos/checks-control';
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
 * `locked` is why the viewer cannot flip the switch (they did not install the
 * app, or the repository's file decides), or null; the server enforces it too.
 */
export function useRepoChecks(
  repo: string | null,
  paused: boolean,
  control: Readonly<ChecksControl>,
): {
  request: () => void;
  dialog: ReactElement | null;
  problem: string | null;
  locked: string | null;
} {
  const locked = lockedReason(control);
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
    request: () => {
      if (locked !== null) {
        return;
      }
      if (paused) {
        apply(true);
      } else {
        setAsking(true);
      }
    },
    problem,
    locked,
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
  locked,
  onRequest,
}: Readonly<{
  paused: boolean;
  /** Why the viewer cannot flip the switch; the entry is then disabled and says so. */
  locked: string | null;
  onRequest: () => void;
}>): ReactElement {
  const reason = useId();
  return (
    <>
      <button
        type="button"
        className={cn(POPOVER_ITEM, locked !== null && 'opacity-60')}
        onClick={onRequest}
        disabled={locked !== null}
        aria-describedby={locked === null ? undefined : reason}
      >
        {paused ? 'Turn checks on' : 'Turn checks off'}
      </button>
      {locked === null ? null : (
        <p id={reason} className="px-3 py-1 text-xs text-muted">
          {locked}
        </p>
      )}
    </>
  );
}

/**
 * A small on/off switch for the repository's checks, for the repository's page:
 * on means webhooks and the schedule check it. Turning it off asks first.
 */
export function ChecksSwitch({
  repo,
  paused,
  control,
}: Readonly<{
  repo: string;
  paused: boolean;
  control: Readonly<ChecksControl>;
}>): ReactElement {
  const { request, dialog, problem, locked } = useRepoChecks(
    repo,
    paused,
    control,
  );
  const reason = useId();
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={!paused}
        aria-label={`Checks for ${repo}`}
        aria-describedby={locked === null ? undefined : reason}
        disabled={locked !== null}
        onClick={request}
        className={cn(
          'focus-ring inline-flex items-center gap-2 rounded-full text-sm font-medium text-muted',
          locked === null ? 'hover:text-ink' : 'cursor-not-allowed opacity-60',
        )}
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
      {locked === null ? null : (
        <p id={reason} className="text-xs text-muted">
          {locked}
        </p>
      )}
      {problem ? (
        <p role="alert" className="text-xs text-failed">
          {problem}
        </p>
      ) : null}
      {dialog}
    </>
  );
}
