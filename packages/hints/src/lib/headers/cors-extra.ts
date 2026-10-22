/**
 * The rest of the CORS response-header family, beyond the
 * `Access-Control-Allow-Origin` decision that `cors.ts` makes. These are all
 * read from the main document's response (no preflight is sent), so a check
 * reports only what the headers themselves reveal, following the MDN
 * reference pages for each one.
 */
import { finding, type Finding } from './finding.js';
import { splitList } from './http-headers.js';

/** Methods a cross-origin request may legitimately be granted. */
const SAFE_METHODS = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);

/**
 * `Access-Control-Allow-Credentials: true` lets a cross-origin request carry
 * cookies and other credentials. Combined with an `Allow-Origin` of `*` it is
 * a specification error browsers reject, and on its own it widens the attack
 * surface, so it is reported — as an error when paired with `*`, otherwise as
 * advice.
 */
export function corsAllowCredentialsFindings(
  allowCredentials: string | null,
  allowOrigin: string | null,
): Finding[] {
  if (allowCredentials === null) {
    return [];
  }
  if (allowCredentials.trim().toLowerCase() !== 'true') {
    return [
      finding(
        'warning',
        `The 'Access-Control-Allow-Credentials' header should be 'true' or omitted, not '${allowCredentials}'.`,
      ),
    ];
  }
  if (allowOrigin?.trim() === '*') {
    return [
      finding(
        'error',
        "'Access-Control-Allow-Credentials: true' cannot be combined with 'Access-Control-Allow-Origin: *'; browsers reject it. Echo a specific origin instead.",
      ),
    ];
  }
  return [
    finding(
      'warning',
      "'Access-Control-Allow-Credentials: true' exposes credentialed data cross-origin; send it only to origins that need it.",
    ),
  ];
}

/**
 * `Access-Control-Allow-Methods` lists the methods a cross-origin request may
 * use. A wildcard `*` (which is ignored for credentialed requests) or an
 * unrecognised method token is reported.
 */
export function corsAllowMethodsFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const methods = splitList(value);
  if (methods.includes('*')) {
    return [
      finding(
        'warning',
        "'Access-Control-Allow-Methods: *' allows every method and is ignored for credentialed requests; list only the methods the resource supports.",
      ),
    ];
  }
  const unknown = methods.filter(
    (method) => !SAFE_METHODS.has(method.toUpperCase()),
  );
  return unknown.length > 0
    ? [
        finding(
          'warning',
          `The 'Access-Control-Allow-Methods' header lists unrecognised methods: ${unknown.join(', ')}.`,
        ),
      ]
    : [];
}

/**
 * `Access-Control-Allow-Headers` lists the request headers a cross-origin
 * request may send. A wildcard `*` is reported: it is ignored for
 * credentialed requests and otherwise grants more than almost any resource
 * needs.
 */
export function corsAllowHeadersFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  return splitList(value).includes('*')
    ? [
        finding(
          'warning',
          "'Access-Control-Allow-Headers: *' allows every request header and is ignored for credentialed requests; list only the headers the resource reads.",
        ),
      ]
    : [];
}

/** Response headers that should not normally be exposed to other origins. */
const SENSITIVE_EXPOSED = new Set([
  'set-cookie',
  'authorization',
  'www-authenticate',
  'proxy-authenticate',
]);

/**
 * `Access-Control-Expose-Headers` names the response headers a script on
 * another origin may read. Exposing `*` (ignored when credentials are allowed)
 * or a sensitive header such as `Set-Cookie` is reported.
 */
export function corsExposeHeadersFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const headers = splitList(value);
  if (headers.includes('*')) {
    return [
      finding(
        'warning',
        "'Access-Control-Expose-Headers: *' exposes every response header and is ignored for credentialed requests; name only the headers the client needs.",
      ),
    ];
  }
  const sensitive = headers.filter((header) =>
    SENSITIVE_EXPOSED.has(header.toLowerCase()),
  );
  return sensitive.length > 0
    ? [
        finding(
          'warning',
          `The 'Access-Control-Expose-Headers' header exposes sensitive headers cross-origin: ${sensitive.join(', ')}.`,
        ),
      ]
    : [];
}

/** One day: preflight results cached longer than this are flagged. */
const MAX_REASONABLE_AGE = 86400;

/**
 * `Access-Control-Max-Age` caches a preflight result for the given number of
 * seconds. A non-integer value is reported as malformed, and a very large
 * value is reported because it keeps a stale CORS policy in force long after
 * the server changes it (browsers also cap it well below a day).
 */
export function corsMaxAgeFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return [
      finding(
        'warning',
        `The 'Access-Control-Max-Age' header must be a whole number of seconds, not '${value}'.`,
      ),
    ];
  }
  const seconds = Number(trimmed);
  return seconds > MAX_REASONABLE_AGE
    ? [
        finding(
          'hint',
          `The 'Access-Control-Max-Age' header caches preflight results for ${seconds} seconds; a long cache keeps a stale CORS policy in force.`,
        ),
      ]
    : [];
}
