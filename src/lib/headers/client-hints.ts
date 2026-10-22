/**
 * Performance, timing and client-hint response headers. The client-hint
 * negotiation headers (`Accept-CH`, `Critical-CH`) and `Timing-Allow-Origin`
 * are privacy-adjacent — client hints are a fingerprinting surface and timing
 * exposure leaks cross-origin load data — while `Alt-Svc` and `Retry-After`
 * are operational. Each check follows the header's MDN reference page.
 */
import { finding, type Finding } from './finding.js';
import { splitList } from './http-headers.js';

/** A structured-field token, the shape a client-hint name takes. */
const TOKEN = /^[A-Za-z*][A-Za-z0-9:/!#$%&'*+.^_`|~-]*$/;

/** The HTTP-date shape `Retry-After` may use, as a quick well-formedness gate. */
const IMF_FIXDATE =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/**
 * Reads the hint names from an `Accept-CH` / `Critical-CH` token list,
 * returning null when any member is not a valid token.
 */
function hintTokens(value: string): string[] | null {
  const tokens = splitList(value);
  return tokens.every((token) => TOKEN.test(token)) ? tokens : null;
}

/**
 * `Accept-CH` advertises the client hints the server would like the browser to
 * send on subsequent requests. It must be a valid token list; a malformed
 * entry is reported, and because every requested hint widens the browser's
 * fingerprinting surface, a well-formed list is noted as information.
 */
export function acceptChFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const tokens = hintTokens(value);
  if (tokens === null) {
    return [
      finding(
        'warning',
        `The 'Accept-CH' header must be a list of client-hint tokens, not '${value}'.`,
      ),
    ];
  }
  return tokens.length === 0
    ? []
    : [
        finding(
          'hint',
          `The 'Accept-CH' header requests ${tokens.length} client hint(s) (${tokens.join(', ')}); each one adds to the fingerprinting surface, so request only what is needed.`,
        ),
      ];
}

/**
 * `Critical-CH` marks client hints as critical, so the browser retries the
 * request when it did not send them. Every critical hint must also appear in
 * `Accept-CH`; one that does not is a configuration error because it is never
 * requested in the first place.
 */
export function criticalChFindings(
  critical: string | null,
  acceptCh: string | null,
): Finding[] {
  if (critical === null) {
    return [];
  }
  const criticalTokens = hintTokens(critical);
  if (criticalTokens === null) {
    return [
      finding(
        'warning',
        `The 'Critical-CH' header must be a list of client-hint tokens, not '${critical}'.`,
      ),
    ];
  }
  const accepted = new Set(
    (acceptCh === null ? [] : (hintTokens(acceptCh) ?? [])).map((token) =>
      token.toLowerCase(),
    ),
  );
  const orphaned = criticalTokens.filter(
    (token) => !accepted.has(token.toLowerCase()),
  );
  return orphaned.length > 0
    ? [
        finding(
          'error',
          `The 'Critical-CH' header lists hints that are not in 'Accept-CH' and so are never requested: ${orphaned.join(', ')}.`,
        ),
      ]
    : [];
}

/** True for a value that is a valid serialized origin (scheme://host[:port]). */
function isOrigin(value: string): boolean {
  if (value === 'null') {
    return true;
  }
  try {
    const url = new URL(value);
    // An origin has no path, query or fragment.
    return `${url.protocol}//${url.host}` === value && url.host !== '';
  } catch {
    return false;
  }
}

/**
 * `Timing-Allow-Origin` names the origins allowed to read detailed resource
 * timing for this response, or `*` for all. `*` is reported because it exposes
 * timing data to every origin, and a member that is neither `*` nor a valid
 * origin is reported as malformed.
 */
export function timingAllowOriginFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const members = splitList(value);
  if (members.includes('*')) {
    return [
      finding(
        'warning',
        "'Timing-Allow-Origin: *' exposes resource-timing data to every origin; list only the origins that need it.",
      ),
    ];
  }
  const invalid = members.filter((member) => !isOrigin(member));
  return invalid.length > 0
    ? [
        finding(
          'warning',
          `The 'Timing-Allow-Origin' header must list origins or '*', not: ${invalid.join(', ')}.`,
        ),
      ]
    : [];
}

/**
 * `Alt-Svc` advertises alternative services (typically HTTP/2 or HTTP/3) for
 * the origin. It is informational: `clear` withdraws all alternatives, and a
 * well-formed list of `protocol=authority` entries is surfaced as information.
 * A value that is neither is reported as malformed.
 */
export function altSvcFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === 'clear') {
    return [];
  }
  const services = value
    .split(',')
    .map((service) => service.trim().split(';')[0]?.trim() ?? '')
    .filter(Boolean);
  const malformed = services.some((service) => !/^[^=]+=.+$/.test(service));
  if (services.length === 0 || malformed) {
    return [
      finding(
        'warning',
        `The 'Alt-Svc' header must be 'clear' or a list of protocol="authority" entries, not '${value}'.`,
      ),
    ];
  }
  const protocols = services.map((service) => service.split('=')[0]);
  return [
    finding(
      'hint',
      `The 'Alt-Svc' header advertises alternative services (${protocols.join(', ')}).`,
    ),
  ];
}

/**
 * `Retry-After` tells the client how long to wait before retrying, as either a
 * delta-seconds value or an HTTP-date. It is only meaningful on a 429 (Too
 * Many Requests) or 503 (Service Unavailable) response; elsewhere it is not
 * applicable. When present on a relevant status it must be well-formed.
 */
export function retryAfterFindings(
  value: string | null,
  statusCode: number,
): Finding[] {
  if (value === null) {
    return [];
  }
  if (statusCode !== 429 && statusCode !== 503) {
    // Not applicable: the header has no defined meaning on other responses.
    return [];
  }
  const trimmed = value.trim();
  const valid =
    /^\d+$/.test(trimmed) ||
    (IMF_FIXDATE.test(trimmed) && !Number.isNaN(Date.parse(trimmed)));
  return valid
    ? []
    : [
        finding(
          'warning',
          `The 'Retry-After' header must be a number of seconds or an HTTP-date, not '${value}'.`,
        ),
      ];
}
