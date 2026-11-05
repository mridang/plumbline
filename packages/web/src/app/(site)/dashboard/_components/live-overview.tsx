'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';

import { RepoCard } from '@/components/repos/repo-card';
import type { RepoStatus } from '@/domain/db/live';
import {
  browserEnvironment,
  keepStreamWhileVisible,
} from '@/domain/live/connection';
import { applyEvent, parseEvent, tally } from '@/domain/live/events';

/** How long the page waits for a burst of events before it shows them, in milliseconds. */
const READ_AGAIN_MS = 250;

/**
 * The status of every repository, kept live: the page opens a stream of what
 * happens to the person's sites and shows each check beginning and ending as
 * it does. The browser reconnects a dropped stream by itself and the server
 * replays what was missed; when it cannot, the overview is read again.
 */
export function LiveOverview({
  initial,
  hidden,
  showHidden,
}: Readonly<{
  initial: readonly RepoStatus[];
  /** The repositories the person has hidden. */
  hidden: readonly string[];
  /** Whether hidden repositories are listed (dimmed) or left out. */
  showHidden: boolean;
}>): ReactElement {
  const router = useRouter();
  const [repos, setRepos] = useState<readonly RepoStatus[]>(initial);

  const [live, setLive] = useState(false);

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      return undefined;
    }
    let source: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // What the page was drawn with is read again by the server, not by a call
    // of ours: the page is the one place that knows how to read it.
    const reread = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), READ_AGAIN_MS);
    };
    // The stream is open only while the tab is showing (and for a short while
    // after it is hidden): a tab nobody looks at must not hold a connection.
    const stopKeeping = keepStreamWhileVisible(
      {
        open: () => {
          const opened = new EventSource('/events');
          source = opened;
          // A fresh stream starts from now, so read once on every (re)connection to
          // pick up whatever happened while it was away.
          opened.addEventListener('open', () => {
            setLive(true);
            reread();
          });
          opened.addEventListener('error', () => setLive(false));
          opened.addEventListener('live', (message) => {
            const event = parseEvent((message as MessageEvent<string>).data);
            if (event) {
              setRepos((current) => applyEvent(current, event));
            }
          });
          opened.addEventListener('reset', reread);
        },
        close: () => {
          source?.close();
          source = undefined;
          setLive(false);
        },
      },
      browserEnvironment(),
    );
    return () => {
      clearTimeout(timer);
      stopKeeping();
    };
  }, [router]);

  const hiddenSet = new Set(hidden);
  const isHidden = (repo: RepoStatus): boolean =>
    repo.repo !== null && hiddenSet.has(repo.repo);
  const shown = repos.filter((repo) => showHidden || !isHidden(repo));
  const hiddenCount = repos.filter(isHidden).length;
  const counts = tally(repos.filter((repo) => !isHidden(repo)));
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="text-sm text-muted" aria-live="polite">
          {total === 0
            ? 'No sites yet.'
            : `${total} ${total === 1 ? 'site' : 'sites'}: ${counts.running} checking, ${counts.failing + counts.unreachable} failing, ${counts.warning} with warnings, ${counts.ok} all clear.`}{' '}
          <span className={live ? 'text-passed' : 'text-subtle'}>
            {live ? '● Live' : '○ Connecting…'}
          </span>
        </p>
        {hiddenCount > 0 || showHidden ? (
          <Link
            href={showHidden ? '/dashboard' : '/dashboard?hidden=1'}
            className="focus-ring text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {showHidden ? 'Hide hidden' : `Show hidden (${hiddenCount})`}
          </Link>
        ) : null}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {shown.map((repo) => (
          <RepoCard
            key={repo.repo ?? 'by-hand'}
            repo={repo}
            hidden={isHidden(repo)}
          />
        ))}
      </div>
      {hiddenCount > 0 ? (
        <p className="mt-6 text-sm text-subtle">
          Hiding a repository only takes it off this page. Its sites are still
          checked, and GitHub still hears about them.
        </p>
      ) : null}
    </div>
  );
}
