/**
 * @packageDocumentation
 *
 * The public references the checks are ported from, as the home page names
 * them. The full list, with each check's origin, is in the hints package's
 * README and on every check in a report.
 */

/** One reference the checks come from. */
export interface RuleSource {
  readonly name: string;
  readonly url: string;
}

/** The references named on the home page, best known first. */
export const RULE_SOURCES: readonly RuleSource[] = [
  {
    name: 'Mozilla Observatory',
    url: 'https://developer.mozilla.org/en-US/observatory',
  },
  { name: 'OWASP', url: 'https://owasp.org/www-project-secure-headers/' },
  { name: 'internet.nl', url: 'https://internet.nl' },
  { name: 'Webbkoll', url: 'https://webbkoll.5july.net' },
  {
    name: 'MDN',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers',
  },
  { name: 'Is It Agent Ready', url: 'https://isitagentready.com' },
  { name: 'Open Graph', url: 'https://ogp.me' },
];
