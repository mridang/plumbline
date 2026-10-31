/**
 * @packageDocumentation
 *
 * The `structuredContent` contracts shared between the MCP server (which builds
 * them) and the MCP Apps Views (React components that render them). Keeping one
 * typed shape means the server and the iframe can't drift.
 *
 * These types ARE the tool `outputSchema` payloads: a tool returns
 * `structuredContent` matching one of these, and the View reads it via the
 * ext-apps `App.ontoolresult` handler (`params.structuredContent`).
 */

/** How many checks ended each way. */
export interface ReportTally {
  readonly passed: number;
  readonly warned: number;
  readonly failed: number;
  readonly skipped: number;
}

/** One thing a check found, as the report view shows it. */
export interface ReportFinding {
  readonly message: string;
  readonly resource: string;
  /** The evidence: the header, the markup or the record at fault. */
  readonly snippet?: string;
}

/** One check that failed or warned, with what it found. */
export interface ReportProblem {
  readonly id: string;
  readonly name: string;
  readonly status: 'failed' | 'warned';
  readonly findings: readonly ReportFinding[];
}

/**
 * The payload `get_report` returns as `structuredContent` for the report View:
 * the domain, when and what was scanned, the tally, and every check that failed
 * or warned (the ones that passed or were skipped are only counted).
 */
export interface ReportData extends ReportTally {
  readonly host: string;
  readonly url: string;
  readonly created_at: string;
  /** The page on plumbline that shows the domain and runs it again. */
  readonly link: string;
  readonly problems: readonly ReportProblem[];
}

/** A single entry in the domain-list view. */
export interface DomainListItem {
  readonly id: string;
  readonly host: string;
  /** How many checks run for the domain. */
  readonly checks: number;
  /** The tally of its newest report, when it has one. */
  readonly latest?: ReportTally & { readonly created_at: string };
}

/** The payload `list_domains` returns as `structuredContent` for the list View. */
export interface DomainListData {
  readonly domains: readonly DomainListItem[];
  /** How many checks there are in all. */
  readonly total_checks: number;
  /** The page on plumbline that lists the domains. */
  readonly link: string;
}
