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

/** The name of the protected resource, in its RFC 9728 metadata. */
export const RESOURCE_NAME = 'Plumbline domains';

/**
 * The scopes this app offers. A scope that is named above but left out here is
 * understood and never granted, so a call that needs it is refused.
 */
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_WRITE] as const;

/**
 * The failures of this app's own making that an assistant can act on, as the
 * words to tell it, or undefined when the failure is not one of them.
 *
 * It lives here rather than in the call path because what can go wrong is the
 * app's own business: every app's `tool-calls.ts` is the same file. This app has
 * no such failure of its own yet, so nothing is recognised here.
 */
export function explainFailure(_error: unknown): string | undefined {
  return undefined;
}
