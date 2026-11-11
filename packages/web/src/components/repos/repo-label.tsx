import Link from 'next/link';
import type { ReactElement } from 'react';

import { GithubIcon } from '@/components/icons';
import { repoPath } from '@/components/repos/repo-path';
import { cn } from '@/components/ui/cn';

/** The owner and the name of `owner/name`; a name with no slash has no owner. */
export function splitRepo(repo: string): { owner: string; name: string } {
  const at = repo.indexOf('/');
  return at === -1
    ? { owner: '', name: repo }
    : { owner: repo.slice(0, at), name: repo.slice(at + 1) };
}

/**
 * A repository as it is named on GitHub: the Octocat, the owner quietly and the
 * name strongly. With `href` the name is the link; `plain` leaves the page's
 * own link out (for a row that links elsewhere).
 */
export function RepoLabel({
  repo,
  href,
  size = 'md',
  className,
}: Readonly<{
  repo: string;
  /** Where the name leads; defaults to the repository's page. `false` leaves it as text. */
  href?: string | false;
  size?: 'md' | 'lg';
  className?: string;
}>): ReactElement {
  const { owner, name } = splitRepo(repo);
  const target = href === undefined ? repoPath(repo) : href;
  const text = (
    <>
      {owner ? <span className="font-normal text-muted">{owner}/</span> : null}
      <span className="font-semibold">{name}</span>
    </>
  );
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-2',
        size === 'lg' ? 'text-xl sm:text-2xl' : 'text-sm',
        className,
      )}
    >
      <GithubIcon
        className={cn(
          'shrink-0 text-subtle',
          size === 'lg' ? 'size-5 sm:size-6' : 'size-4',
        )}
      />
      {target === false ? (
        <span className="min-w-0 truncate" title={repo}>
          {text}
        </span>
      ) : (
        <Link
          href={target}
          title={repo}
          className="focus-ring min-w-0 truncate underline-offset-4 hover:underline"
        >
          {text}
        </Link>
      )}
    </span>
  );
}
