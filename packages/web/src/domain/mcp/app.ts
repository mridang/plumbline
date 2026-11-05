/**
 * @packageDocumentation
 *
 * What this app's connector has of its own, read by the shared OAuth and MCP
 * code (`lib/oauth/`, `lib/mcp/`): the names of its two scopes and what they
 * allow in words, which tools only read, the name its protected resource goes
 * by, and the looser spellings of tool arguments it accepts. Everything in
 * those libraries is the same in every app.
 */

/** May see domains, their checks and their reports. */
export const SCOPE_READ = 'checks:read';
/** May remove sites and choose their checks (implies read). */
export const SCOPE_WRITE = 'checks:write';

/** What each scope lets the app do, in plain words, for the approval screen. */
export const SCOPE_TEXT: Readonly<Record<string, string>> = {
  [SCOPE_READ]:
    'See your domains, the checks chosen for them and their reports',
  [SCOPE_WRITE]: 'Remove sites, and choose which checks run',
};

/**
 * What a read-only connection may still do, in a few words, for the approval
 * screen's choice to allow less than the app asked for ("Read only: …, but
 * change nothing").
 */
export const READ_ONLY_TEXT = 'see domains and reports';

/**
 * Tools that only read. Anything not listed here is treated as a write, so a
 * newly added tool is protected by default until someone classifies it.
 * Scanning counts as reading: it runs the checks and keeps nothing.
 */
export const READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'list_checks',
  'list_domains',
  'list_repositories',
  'get_domain',
  'get_report',
  'list_reports',
  'scan_domain',
]);

/** The name of the protected resource, in its RFC 9728 metadata. */
export const RESOURCE_NAME = 'Plumbline domains';

/**
 * Older or looser spellings of a tool's arguments, and the canonical name each
 * one stands for. The catalogue lists only the canonical names (so a model sees
 * one way to say each thing, and the input schemas stay closed), but a
 * connector that cached an earlier catalogue, or a model that carries an
 * argument over from a similar tool, must not start failing: its spelling is
 * renamed before the arguments are checked. A domain is often sent as a `host`
 * or a `url`.
 */
export const ARGUMENT_ALIASES: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  get_domain: { host: 'domain', url: 'domain' },
  get_report: { host: 'domain', url: 'domain' },
  list_reports: { host: 'domain', url: 'domain' },
  scan_domain: { host: 'domain', url: 'domain' },
  remove_domain: { host: 'domain', url: 'domain' },
  configure_checks: { host: 'domain', url: 'domain', checks: 'enable' },
};

/**
 * Arguments that are declared as a list of text but that models often send as
 * one piece of text ("csp-header"). That text is wrapped into a one-item list.
 */
export const LISTS_OF_TEXT: Readonly<Record<string, readonly string[]>> = {
  configure_checks: ['enable', 'disable'],
};
