'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { problemText } from '@/components/api/problem-message';
import { setRepoHidden } from '@/components/repos/hide-repo';
import { POPOVER_ITEM } from '@/components/ui/popover';

/**
 * The "Hide" or "Unhide" entry of a row's menu: it hides the repository from the
 * dashboard (or shows it again) and reads the page again. A problem is said in
 * the menu's place, since the menu closes when something in it is chosen.
 */
export function HideAction({
  repo,
  hidden,
}: Readonly<{ repo: string; hidden: boolean }>): ReactElement {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={POPOVER_ITEM}
        onClick={() => {
          setProblem(null);
          setRepoHidden(repo, !hidden).then(
            () => router.refresh(),
            (error: unknown) =>
              setProblem(problemText(error, 'Could not change that.')),
          );
        }}
      >
        {hidden ? 'Unhide' : 'Hide from dashboard'}
      </button>
      {problem ? (
        <p role="alert" className="px-3 py-1 text-xs text-failed">
          {problem}
        </p>
      ) : null}
    </>
  );
}
