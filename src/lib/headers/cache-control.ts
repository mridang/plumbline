/**
 * OWASP Secure Headers Project: `Cache-Control: no-store, max-age=0`.
 *
 * The rule is meant for applications that serve private, per-user pages. On
 * a public site it would disable caching for everything, so the hint only
 * applies it when `enforce` is switched on. The directives are compared as a
 * set, so their order does not matter.
 */
import { finding, type Finding } from './finding.js';

const REQUIRED = ['no-store', 'max-age=0'];

export function cacheControlFindings(value: string | null): Finding[] {
  if (value === null) {
    return [finding('error', "The 'Cache-Control' header was not specified.")];
  }
  const directives = value
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d !== '');
  const exact =
    directives.length === REQUIRED.length &&
    REQUIRED.every((d) => directives.includes(d));
  return exact
    ? []
    : [
        finding(
          'error',
          "The 'Cache-Control' header should be 'no-store, max-age=0'.",
        ),
      ];
}
