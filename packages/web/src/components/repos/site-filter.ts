/**
 * @packageDocumentation
 *
 * What the dashboard can be narrowed by, as data. Two things are kept apart:
 *
 * - the **state** of a site: live (its repository's checks are on and it
 *   answers), paused (the checks are switched off) or unresponsive (it does not
 *   answer); and
 * - the **result** of its last check: failing, warnings, passing, checking now,
 *   or unchecked.
 *
 * Paused is not a result, so a paused site is in no result count. The chips,
 * their counts, the address and the list all come from the rules here, so a
 * chip's number is always the number of rows it shows. Pure, so the page and the
 * tests use the same rules.
 */

import type { SiteRow } from '@/components/repos/site-rows';
import type { SiteState } from '@/domain/db/live';

/** The result of a site's last check. */
export type SiteResult = Exclude<SiteState, 'unreachable'>;

/** The state of a site, apart from its result. */
export type SiteAvailability = 'live' | 'paused' | 'unresponsive';

/** What a result chip or the unresponsive chip filters by. */
export type StatusFilter = SiteResult | 'unresponsive';

/** The result of a site's last check, or null for one that does not answer (it has none to show). */
export function resultOf(state: SiteState): SiteResult | null {
  return state === 'unreachable' ? null : state;
}

/** The state of a site: paused wins, since a paused site is not checked and so not known to be down. */
export function availabilityOf(
  state: SiteState,
  paused: boolean,
): SiteAvailability {
  if (paused) {
    return 'paused';
  }
  return state === 'unreachable' ? 'unresponsive' : 'live';
}

/** A filter: at most one status, and whether paused sites are listed. */
export interface Filter {
  readonly status: StatusFilter | null;
  readonly paused: boolean;
}

/** No filter: every site that is not paused. */
export const NO_FILTER: Filter = { status: null, paused: false };

/** A chip: the filter it sets and the words for it, in the order they are shown. */
export interface ChipSpec {
  readonly status: StatusFilter;
  /** The value in the address (`?status=`). */
  readonly param: string;
  readonly label: string;
}

/** The chips, always these and always in this order, whatever the counts are. */
export const CHIPS: readonly ChipSpec[] = [
  { status: 'failing', param: 'failing', label: 'Failing' },
  { status: 'warning', param: 'warnings', label: 'Warnings' },
  { status: 'ok', param: 'passing', label: 'Passing' },
  { status: 'running', param: 'checking', label: 'Checking' },
  { status: 'unchecked', param: 'unchecked', label: 'Unchecked' },
  { status: 'unresponsive', param: 'unresponsive', label: 'Unresponsive' },
];

/** How many rows each chip shows, the rows without a filter, and the paused ones. */
export type Counts = Readonly<Record<StatusFilter, number>> & {
  /** The sites that are not paused: what the list shows with no filter. */
  readonly all: number;
  /** The sites whose repository is paused. */
  readonly paused: number;
};

/** Whether a row is in the list under a filter. */
export function matches(row: SiteRow, filter: Filter): boolean {
  if (row.paused) {
    // A paused site has no result to filter by: it is listed only when asked
    // for and only when no status narrows the list.
    return filter.paused && filter.status === null;
  }
  if (filter.status === null) {
    return true;
  }
  return filter.status === 'unresponsive'
    ? availabilityOf(row.site.state, false) === 'unresponsive'
    : resultOf(row.site.state) === filter.status;
}

/** The rows under a filter, in their order. */
export function applyFilter(
  rows: readonly SiteRow[],
  filter: Filter,
): readonly SiteRow[] {
  return rows.filter((row) => matches(row, filter));
}

/** The counts for a set of rows. Paused rows are in no count but their own. */
export function countsOf(rows: readonly SiteRow[]): Counts {
  const counts = {
    all: 0,
    paused: 0,
    failing: 0,
    warning: 0,
    ok: 0,
    running: 0,
    unchecked: 0,
    unresponsive: 0,
  };
  for (const row of rows) {
    if (row.paused) {
      counts.paused += 1;
      continue;
    }
    counts.all += 1;
    const result = resultOf(row.site.state);
    if (result === null) {
      counts.unresponsive += 1;
    } else {
      counts[result] += 1;
    }
  }
  return counts;
}

/** The filter after a chip is pressed: that status, or none when it is the one already set. */
export function toggleStatus(filter: Filter, status: StatusFilter): Filter {
  return { ...filter, status: filter.status === status ? null : status };
}

/** The filter after the paused toggle is pressed. */
export function togglePaused(filter: Filter): Filter {
  return { ...filter, paused: !filter.paused };
}

/** The filter an address asks for; anything it does not know counts as no filter. */
export function filterOf(
  params: Readonly<{ status?: string; paused?: string }>,
): Filter {
  const chip = CHIPS.find((spec) => spec.param === params.status);
  return { status: chip?.status ?? null, paused: params.paused === '1' };
}

/** The query string (with its `?`, or empty) that carries a filter and a view. */
export function queryOf(
  filter: Filter,
  view: 'table' | 'cards' = 'table',
): string {
  const params = new URLSearchParams();
  if (view === 'cards') {
    params.set('view', 'cards');
  }
  const chip = CHIPS.find((spec) => spec.status === filter.status);
  if (chip) {
    params.set('status', chip.param);
  }
  if (filter.paused) {
    params.set('paused', '1');
  }
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

/** The summary of the list: "9 sites", with the paused ones named when there are any. */
export function summaryOf(counts: Counts): string {
  const total = counts.all + counts.paused;
  const sites = `${total} ${total === 1 ? 'site' : 'sites'}`;
  return counts.paused > 0 ? `${sites} · ${counts.paused} paused` : sites;
}

/** The result that needs the most attention among `states` (a repository's overall result), or null when none has one. */
export function worstResult(states: readonly SiteState[]): SiteResult | null {
  const order: readonly SiteResult[] = [
    'failing',
    'warning',
    'running',
    'unchecked',
    'ok',
  ];
  const results = new Set(states.map(resultOf));
  return order.find((result) => results.has(result)) ?? null;
}
