import type { ReactElement } from 'react';

import { GithubIcon } from '@/components/icons';
import { BadgeMenu } from '@/components/repos/badge-menu';
import type { ChecksControl } from '@/components/repos/checks-control';
import { TURNED_OFF_IN_FILE } from '@/components/repos/checks-messages';
import { ChecksSwitch } from '@/components/repos/checks-switch';
import { RepoLabel } from '@/components/repos/repo-label';
import { Badge } from '@/components/ui-app/badge';
import { StatusBadge } from '@/components/repos/site-state';
import { LinkButton } from '@/components/ui-app/link-button';
import { PageHeading } from '@/components/ui-app/page-heading';
import type { SiteState } from '@/domain/db/live';
import { countOf } from '@/lib/intl';

/**
 * The top of a repository's page, as one compact band: the Octocat and the
 * name (the owner quiet, the repository strong), how the worst site stands and
 * how many sites there are, and on the right the two things you do with the
 * repository itself: the README badge and its page on GitHub.
 */
export function RepoHeader({
  repo,
  state,
  paused,
  control,
  siteCount,
  badgeImage,
  badgeMarkdown,
}: Readonly<{
  repo: string;
  /** How the worst of its sites stands. */
  state: SiteState;
  /** Whether checks are turned off for the repository. */
  paused: boolean;
  /** What the viewer may do with the repository's checks switch. */
  control: Readonly<ChecksControl>;
  siteCount: number;
  badgeImage: string;
  badgeMarkdown: string;
}>): ReactElement {
  return (
    <PageHeading
      title={<RepoLabel repo={repo} href={false} size="lg" />}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {paused ? (
            <>
              <Badge>Paused</Badge>
              {control.fileOff ? <span>{TURNED_OFF_IN_FILE}</span> : null}
            </>
          ) : (
            <StatusBadge state={state} size="md" />
          )}
          <span>{countOf(siteCount, 'site')}</span>
        </span>
      }
      actions={
        <>
          <ChecksSwitch repo={repo} paused={paused} control={control} />
          <BadgeMenu repo={repo} image={badgeImage} markdown={badgeMarkdown} />
          <LinkButton
            href={`https://github.com/${repo}`}
            external
            variant="outline"
            size="sm"
          >
            <GithubIcon size="sm" />
            View on GitHub
          </LinkButton>
        </>
      }
    />
  );
}
