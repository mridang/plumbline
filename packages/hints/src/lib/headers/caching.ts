/**
 * Caching and conditional-request response headers. These are correctness and
 * quality checks, faithful to each header's MDN reference page: validators for
 * the HTTP-date headers (`Last-Modified`, `Expires`), the delta-seconds header
 * (`Age`), the validator header (`ETag`), the `Vary` shape and the structured
 * `No-Vary-Search` header. None of these duplicates the HTTP-compression
 * check; `Vary` is examined only for its own shape.
 */
import { finding, type Finding } from './finding.js';
import { splitList } from './http-headers.js';

/** The preferred IMF-fixdate HTTP-date, plus the two obsolete formats. */
const IMF_FIXDATE =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/** True when a value is a valid HTTP-date and names a real calendar day. */
function isHttpDate(value: string): boolean {
  if (!IMF_FIXDATE.test(value.trim())) {
    return false;
  }
  return !Number.isNaN(Date.parse(value.trim()));
}

/**
 * `ETag` is an opaque validator. Any value is accepted, but a value that looks
 * like a leaked filesystem inode (the common Apache `inode-size-mtime` triple,
 * for example `"12345-1b6-5e0a"`) is reported, since it discloses server
 * internals and breaks across load-balanced nodes. Weak validators (`W/"..."`)
 * are noted as information only.
 */
export function etagFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const tag = value.trim();
  const opaque = /^W\//.test(tag) ? tag.slice(2) : tag;
  const inner = /^"(.*)"$/.exec(opaque)?.[1];
  if (inner !== undefined && /^[0-9a-f]+-[0-9a-f]+-[0-9a-f]+$/i.test(inner)) {
    return [
      finding(
        'warning',
        `The 'ETag' header '${tag}' looks like an Apache inode-size-mtime value, which leaks server internals and differs between nodes; configure opaque ETags.`,
      ),
    ];
  }
  return [];
}

/** `Last-Modified` must be a valid HTTP-date. */
export function lastModifiedFindings(value: string | null): Finding[] {
  if (value === null || isHttpDate(value)) {
    return [];
  }
  return [
    finding(
      'warning',
      `The 'Last-Modified' header must be an HTTP-date such as 'Wed, 21 Oct 2015 07:28:00 GMT', not '${value}'.`,
    ),
  ];
}

/**
 * `Expires` must be a valid HTTP-date. When `Cache-Control` also carries a
 * `max-age`, that directive supersedes `Expires`, which is then redundant; the
 * check notes this so the two are not maintained in conflict.
 */
export function expiresFindings(
  value: string | null,
  hasMaxAge: boolean,
): Finding[] {
  if (value === null) {
    return [];
  }
  if (!isHttpDate(value)) {
    // `Expires: 0` is a well-known idiom for "already expired"; still invalid
    // as a date, so it is reported like any other malformed value.
    return [
      finding(
        'warning',
        `The 'Expires' header must be an HTTP-date such as 'Wed, 21 Oct 2015 07:28:00 GMT', not '${value}'.`,
      ),
    ];
  }
  return hasMaxAge
    ? [
        finding(
          'hint',
          "The 'Expires' header is ignored when 'Cache-Control: max-age' is also present; max-age takes precedence.",
        ),
      ]
    : [];
}

/** `Age` is a non-negative number of seconds. */
export function ageFindings(value: string | null): Finding[] {
  if (value === null || /^\d+$/.test(value.trim())) {
    return [];
  }
  return [
    finding(
      'hint',
      `The 'Age' header must be a non-negative number of seconds, not '${value}'.`,
    ),
  ];
}

/**
 * `Vary` lists the request headers a response varies on. `Vary: *` is reported
 * because it makes the response effectively uncacheable by shared caches, and
 * mixing `*` with named headers is contradictory. The names themselves are not
 * second-guessed here (compression and `Accept-Encoding` are covered by the
 * dedicated HTTP-compression check, not duplicated).
 */
export function varyFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const fields = splitList(value);
  if (fields.includes('*')) {
    return fields.length > 1
      ? [
          finding(
            'warning',
            "The 'Vary' header mixes '*' with named headers; '*' already varies on everything and makes the response uncacheable by shared caches.",
          ),
        ]
      : [
          finding(
            'warning',
            "'Vary: *' makes the response uncacheable by shared caches; list the specific request headers it varies on instead.",
          ),
        ];
  }
  return [];
}

/**
 * `No-Vary-Search` is a structured dictionary describing which URL search
 * parameters do not affect the response, for example `key-order` or
 * `params=("utm_source")`. When present it must parse as a dictionary with
 * recognised keys; an empty or malformed value is reported.
 */
const NO_VARY_SEARCH_KEYS = new Set(['key-order', 'params', 'except']);

export function noVarySearchFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const members = value
    .split(',')
    .map((member) => member.trim())
    .filter(Boolean);
  if (members.length === 0) {
    return [finding('warning', "The 'No-Vary-Search' header is empty.")];
  }
  for (const member of members) {
    const key = member.split(/[=;]/, 1)[0]?.trim() ?? '';
    if (!NO_VARY_SEARCH_KEYS.has(key)) {
      return [
        finding(
          'warning',
          `The 'No-Vary-Search' header has an unrecognised key '${key}'; use key-order, params or except.`,
        ),
      ];
    }
  }
  return [];
}
