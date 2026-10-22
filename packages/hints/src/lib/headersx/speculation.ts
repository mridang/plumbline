/**
 * Headers that control speculative loading (prefetch/prerender). `Speculation-
 * Rules` points the browser at an external JSON ruleset, and `Supports-Loading-
 * Mode` opts a response into being prerendered or embedded in a fenced frame.
 * Both are experimental; the checks validate the value when the header is
 * present, following each header's MDN reference page.
 */
import { finding, type Finding } from '../headers/finding.js';
import { tokenList, topLevelMembers } from './structured.js';

/**
 * `Speculation-Rules` is a structured list of strings, each the URL of a JSON
 * speculation-rules document the browser should fetch, for example
 * `Speculation-Rules: "/rules/prefetch.json"`. Every member must be a quoted
 * string holding a non-empty URL; a bare or empty member is reported because
 * the browser cannot resolve it to a ruleset.
 */
export function speculationRulesFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const members = topLevelMembers(value);
  if (!members) {
    return [finding('warning', "The 'Speculation-Rules' header is empty.")];
  }
  for (const member of members) {
    const url = /^"(.*)"$/.exec(member)?.[1];
    if (url === undefined || url.trim() === '') {
      return [
        finding(
          'warning',
          `The 'Speculation-Rules' header must list quoted ruleset URLs, not '${member}'.`,
        ),
      ];
    }
  }
  return [];
}

/** The loading modes a response may declare support for. */
const MODES = new Set(['credentialed-prerender', 'fenced-frame']);

/**
 * `Supports-Loading-Mode` lets a response opt into a non-default loading mode,
 * such as `credentialed-prerender` (prerendered with credentials) or
 * `fenced-frame`. It is a token list; an unrecognised token is reported since
 * the browser ignores it and the intended mode is not enabled.
 */
export function supportsLoadingModeFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const tokens = tokenList(value);
  if (tokens === null || tokens.length === 0) {
    return [
      finding(
        'warning',
        `The 'Supports-Loading-Mode' header must be a list of mode tokens, not '${value}'.`,
      ),
    ];
  }
  const unknown = tokens.filter((token) => !MODES.has(token.toLowerCase()));
  return unknown.length > 0
    ? [
        finding(
          'warning',
          `The 'Supports-Loading-Mode' header has unrecognised mode(s): ${unknown.join(', ')}; use credentialed-prerender or fenced-frame.`,
        ),
      ]
    : [];
}
