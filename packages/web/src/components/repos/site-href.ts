import { repoPath } from '@/components/repos/repo-path';

/** What the address of a repository's page can say besides which repository. */
export interface SiteView {
  /** The report (a run's id) to show; the newest when left out. */
  readonly report?: string | undefined;
  /** `settings` shows the choice of checks in place of the results. */
  readonly view?: 'settings' | undefined;
}

/**
 * The address of one site on its repository's page: the tab (`?site=host`), and
 * the report or the settings view when asked. Everything about what the page
 * shows is in the address, so the page can be linked to and is drawn by the
 * server.
 */
export function siteHref(
  repo: string,
  host: string,
  options: SiteView = {},
): string {
  const query = new URLSearchParams({ site: host });
  if (options.report) {
    query.set('report', options.report);
  }
  if (options.view) {
    query.set('view', options.view);
  }
  return `${repoPath(repo)}?${query.toString()}`;
}
