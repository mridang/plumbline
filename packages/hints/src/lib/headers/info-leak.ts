/**
 * Response headers that disclose implementation detail. None of these is a
 * vulnerability on its own, but each hands an attacker free reconnaissance:
 * the exact software and version to look up known exploits for, backend
 * timings, the chain of proxies in front of the app, or the location of
 * source maps that de-minify the shipped code. The checks follow the MDN
 * reference pages for each header and report (never require) a value.
 */
import { finding, type Finding } from './finding.js';

/**
 * `Server` identifies the software handling the request. A bare product name
 * (`Server: nginx`) is accepted, but a value that also discloses a version or
 * operating system (anything containing a digit, for example `nginx/1.25.3`
 * or `Apache/2.4 (Ubuntu)`) is reported so the version can be hidden.
 */
export function serverBannerFindings(value: string | null): Finding[] {
  if (value === null || !/\d/.test(value)) {
    return [];
  }
  return [
    finding(
      'warning',
      `The 'Server' header discloses software version or platform detail ('${value}'); send only a generic product name, or omit it.`,
    ),
  ];
}

/**
 * `X-Powered-By` is a non-standard header that names the framework or runtime
 * (`X-Powered-By: Express`). It serves no purpose for a browser and should be
 * removed, so any value is reported.
 */
export function xPoweredByFindings(value: string | null): Finding[] {
  return value === null
    ? []
    : [
        finding(
          'warning',
          `The 'X-Powered-By' header reveals the technology stack ('${value}') and should be removed.`,
        ),
      ];
}

/**
 * `Server-Timing` communicates backend performance metrics to the browser for
 * debugging. On a production response those metric names and durations can
 * leak internal architecture, so its presence is surfaced as information.
 */
export function serverTimingFindings(value: string | null): Finding[] {
  return value === null
    ? []
    : [
        finding(
          'hint',
          `The 'Server-Timing' header exposes backend metrics ('${value}'); restrict it to trusted environments rather than every production response.`,
        ),
      ];
}

/**
 * `Via` is added by proxies and gateways and lists the protocol and, often,
 * the name and version of each hop (`Via: 1.1 varnish, 1.1 cloudfront`). When
 * a hop names software it is reported, since it maps the infrastructure.
 */
export function viaFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  // A hop is `[protocol/]version host [comment]`. A token that is not a bare
  // version number (contains a letter) usually names the proxy software.
  const namesSoftware = value
    .split(',')
    .map((hop) => hop.trim())
    .some((hop) => /[a-z]/i.test(hop.replace(/^\S*\/\S*\s*/, '')));
  return namesSoftware
    ? [
        finding(
          'hint',
          `The 'Via' header discloses the proxy or gateway software ('${value}'); configure intermediaries to omit their names.`,
        ),
      ]
    : [];
}

/**
 * `SourceMap` (or the legacy `X-SourceMap`) points the browser's devtools at a
 * source map that reconstructs the original, unminified source. Shipping it on
 * a production response exposes that source, so its presence is reported.
 */
export function sourcemapFindings(
  sourceMap: string | null,
  xSourceMap: string | null,
): Finding[] {
  const header = sourceMap === null ? 'X-SourceMap' : 'SourceMap';
  const value = sourceMap ?? xSourceMap;
  return value === null
    ? []
    : [
        finding(
          'warning',
          `The '${header}' header exposes a source map ('${value}'); serve source maps only to trusted clients.`,
        ),
      ];
}
