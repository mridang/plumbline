import { parseSpf } from './spf.js';

/**
 * The SPF policy test of Internet.nl (`spf_check_policy` in `mail.py`): the
 * record must be syntactically valid, must not need more than 10 DNS lookups
 * and must end in a strict `all` (`-all` or `~all`). `include` and `redirect`
 * targets are followed and held to the same rules.
 */

export type SpfPolicyStatus =
  | 'valid'
  | 'invalid_syntax'
  | 'max_dns_lookups'
  | 'invalid_all'
  | 'invalid_include'
  | 'invalid_redirect';

/** The most DNS lookups an SPF evaluation may need (RFC 7208 section 4.6.4). */
const MAX_SPF_LOOKUPS = 10;

/**
 * Fetches the single SPF record of a domain. Resolves to null when the
 * domain has none or more than one, and rejects when the lookup fails.
 */
export type SpfResolver = (domain: string) => Promise<string | null>;

export interface SpfPolicyResult {
  status: SpfPolicyStatus;
  /** Lookups left; negative when the limit was exceeded. */
  lookupsLeft: number;
  /** The records that were found not to be valid, innermost first. */
  records: { domain: string; record: string }[];
}

interface Walk {
  status: SpfPolicyStatus;
  left: number;
}

/**
 * Checks the SPF policy of `record`, the SPF record of `domain`. Macros in
 * `include` and `redirect` domains are not expanded and so not followed.
 */
export async function checkSpfPolicy(
  domain: string,
  record: string,
  resolve: SpfResolver,
): Promise<SpfPolicyResult> {
  const records: SpfPolicyResult['records'] = [];
  const result = await walk(domain, record, resolve, records, {
    left: MAX_SPF_LOOKUPS,
    isInclude: false,
  });
  return { status: result.status, lookupsLeft: result.left, records };
}

async function walk(
  domain: string,
  record: string,
  resolve: SpfResolver,
  records: SpfPolicyResult['records'],
  state: { left: number; isInclude: boolean },
): Promise<Walk> {
  let left = state.left;
  let status: SpfPolicyStatus = 'valid';
  const parsed = parseSpf(record);

  if (!parsed) {
    status = 'invalid_syntax';
  } else if (parsed.terms.length === 0) {
    // No terms at all: the default result is `?all`, which is neutral.
    status = 'invalid_all';
  } else {
    const includes = [];
    const redirects = [];
    let allFound = false;
    for (const term of parsed.terms) {
      if (term.kind === 'redirect') {
        redirects.push(term);
        left -= 1;
      } else if (term.kind === 'include') {
        includes.push(term);
        left -= 1;
      } else if (
        term.kind === 'mx' ||
        term.kind === 'ptr' ||
        term.kind === 'exists' ||
        term.kind === 'a'
      ) {
        left -= 1;
      } else if (term.kind === 'all') {
        allFound = true;
        // A bare `all` is `+all`; `?all` is only acceptable inside an include.
        if (
          term.qualifier === null ||
          term.qualifier === '+' ||
          (!state.isInclude && term.qualifier === '?')
        ) {
          status = 'invalid_all';
        }
        // Terms after `all` are never evaluated.
        break;
      }
    }

    if (
      status === 'valid' &&
      !state.isInclude &&
      redirects.length === 0 &&
      !allFound
    ) {
      // Neither `all` nor `redirect`: the default is `?all`.
      status = 'invalid_all';
    }

    // Deliberate tightening of the original, which only noticed an exceeded
    // limit when it reached an include or redirect: a record needing more
    // than ten lookups is ineffective whatever its terms are.
    if (status === 'valid' && left < 0) {
      status = 'max_dns_lookups';
    }

    if (status === 'valid') {
      // Redirects are followed after includes.
      for (const term of [...includes, ...redirects]) {
        if (status !== 'valid') {
          break;
        }
        if (term.kind === 'redirect') {
          if (!allFound) {
            const followed = await follow(
              term.value ?? '',
              resolve,
              records,
              left,
              'invalid_redirect',
              false,
            );
            status = followed.status;
            left = followed.left;
            // Only one redirect is followed.
            break;
          }
        } else {
          const followed = await follow(
            term.value ?? '',
            resolve,
            records,
            left,
            'invalid_include',
            true,
          );
          status = followed.status;
          left = followed.left;
        }
      }
    }
  }

  if (status !== 'valid') {
    records.push({ domain, record });
  }
  return { status, left };
}

/** Follows an `include` or `redirect` and maps a bad result to `badStatus`. */
async function follow(
  target: string,
  resolve: SpfResolver,
  records: SpfPolicyResult['records'],
  left: number,
  badStatus: SpfPolicyStatus,
  isInclude: boolean,
): Promise<Walk> {
  if (left < 0) {
    return { status: 'max_dns_lookups', left };
  }
  // Macros cannot be expanded without a real message, so they are not followed.
  if (target.includes('{')) {
    return { status: 'valid', left };
  }
  let next: string | null;
  try {
    next = await resolve(target);
  } catch {
    return { status: badStatus, left };
  }
  if (next === null) {
    return { status: badStatus, left };
  }
  const inner = await walk(target, next, resolve, records, { left, isInclude });
  const status =
    inner.status !== 'valid' && inner.status !== 'max_dns_lookups'
      ? badStatus
      : inner.status;
  return { status, left: inner.left };
}
