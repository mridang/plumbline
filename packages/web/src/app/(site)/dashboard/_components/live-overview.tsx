'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';

import { Card } from '@/components/ui/card';
import type { RepoStatus, SiteState, SiteStatus } from '@/domain/db/live';
import { applyEvent, parseEvent, tally } from '@/domain/live/events';

/** The words and colour for each state. */
const STATES: Readonly<Record<SiteState, { label: string; tone: string }>> = {
  running: { label: 'Checking now', tone: 'text-ink' },
  unchecked: { label: 'Not checked yet', tone: 'text-muted' },
  unreachable: { label: 'Not answering', tone: 'text-failed' },
  failing: { label: 'Failing', tone: 'text-failed' },
  warning: { label: 'Warnings', tone: 'text-warned' },
  ok: { label: 'All clear', tone: 'text-passed' },
};

/** How long the page waits for a burst of events before it shows them, in milliseconds. */
const READ_AGAIN_MS = 250;

/** One site: its state, and what the last check found. */
function Site({ site }: Readonly<{ site: SiteStatus }>): ReactElement {
  const { label, tone } = STATES[site.state];
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      {site.mine ? (
        <Link
          href={`/domains/${site.id}`}
          className="focus-ring font-medium break-all underline-offset-4 hover:underline"
        >
          {site.host}
        </Link>
      ) : (
        <span className="font-medium break-all">{site.host}</span>
      )}
      <span className={`text-sm font-semibold ${tone}`}>
        {site.state === 'running' ? (
          <span
            aria-hidden="true"
            className="mr-2 inline-block size-2 animate-pulse rounded-full bg-current"
          />
        ) : null}
        {label}
        {site.state === 'failing' || site.state === 'warning'
          ? ` · ${site.errors} errors, ${site.warnings} warnings`
          : ''}
      </span>
    </li>
  );
}

/**
 * The status of every repository, kept live: the page opens a stream of what
 * happens to the person's sites and shows each check beginning and ending as
 * it does. The browser reconnects a dropped stream by itself and the server
 * replays what was missed; when it cannot, the overview is read again.
 */
export function LiveOverview({
  initial,
}: Readonly<{ initial: readonly RepoStatus[] }>): ReactElement {
  const router = useRouter();
  const [repos, setRepos] = useState<readonly RepoStatus[]>(initial);

  const [live, setLive] = useState(false);

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      return undefined;
    }
    const source = new EventSource('/events');
    let timer: ReturnType<typeof setTimeout> | undefined;
    // What the page was drawn with is read again by the server, not by a call
    // of ours: the page is the one place that knows how to read it.
    const reread = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), READ_AGAIN_MS);
    };
    // A fresh stream starts from now, so read once on every (re)connection to
    // pick up whatever happened while it was away.
    source.addEventListener('open', () => {
      setLive(true);
      reread();
    });
    source.addEventListener('error', () => setLive(false));
    source.addEventListener('live', (message) => {
      const event = parseEvent((message as MessageEvent<string>).data);
      if (event) {
        setRepos((current) => applyEvent(current, event));
      }
    });
    source.addEventListener('reset', reread);
    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, [router]);

  const counts = tally(repos);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return (
    <div>
      <p className="text-sm text-muted" aria-live="polite">
        {total === 0
          ? 'No sites yet.'
          : `${total} ${total === 1 ? 'site' : 'sites'}: ${counts.running} checking, ${counts.failing + counts.unreachable} failing, ${counts.warning} with warnings, ${counts.ok} all clear.`}{' '}
        <span className={live ? 'text-passed' : 'text-subtle'}>
          {live ? '● Live' : '○ Connecting…'}
        </span>
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {repos.map((repo) => (
          <Card key={repo.repo ?? 'by-hand'} padding="lg">
            <h2 className="text-lg font-semibold break-all">
              {repo.repo ?? 'Added by hand'}
            </h2>
            <ul className="mt-2 divide-y divide-field/60">
              {repo.sites.map((site) => (
                <Site key={site.id} site={site} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
