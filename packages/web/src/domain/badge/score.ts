/**
 * @packageDocumentation
 *
 * The score on a badge: one number for how a repository's sites stand, from
 * what their last checks found. A site starts at 100 and loses 15 for each
 * error and 5 for each warning (hints are only advice and cost nothing),
 * never below 0. A repository's score is the average of its sites, rounded.
 * A site that did not answer scores 0, and one never checked has no score.
 */

import type { SiteState } from '@/domain/db/live';

/** What the badge needs of a site. */
export interface ScoredSite {
  readonly state: SiteState;
  readonly errors: number;
  readonly warnings: number;
}

/** Points lost for each error and each warning. */
export const ERROR_COST = 15;
export const WARNING_COST = 5;

/** The score of one site, or null when it has not been checked. */
export function siteScore(site: Readonly<ScoredSite>): number | null {
  if (site.state === 'unchecked') {
    return null;
  }
  if (site.state === 'unreachable') {
    return 0;
  }
  return Math.max(
    0,
    100 - ERROR_COST * site.errors - WARNING_COST * site.warnings,
  );
}

/** The score of a repository, or null when none of its sites has been checked. */
export function repoScore(sites: readonly ScoredSite[]): number | null {
  const scores = sites
    .map(siteScore)
    .filter((score): score is number => score !== null);
  return scores.length === 0
    ? null
    : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

/** The colour of a score, as a badge colour. */
export function colourOf(score: number | null): string {
  if (score === null) {
    return '#9f9f9f';
  }
  if (score >= 90) {
    return '#2da44e';
  }
  return score >= 70 ? '#dbab09' : '#cf222e';
}
