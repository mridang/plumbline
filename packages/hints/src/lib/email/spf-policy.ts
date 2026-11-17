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

/** The term kinds that each cost one DNS lookup. */
const LOOKUP_KINDS = new Set([
  'redirect',
  'include',
  'a',
  'mx',
  'ptr',
  'exists',
]);

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
  /** The invalid records found on the way, innermost first. */
  records: SpfPolicyResult['records'];
}

/** A bare `all` is `+all`; `?all` is only acceptable inside an include. */
function isInvalidAll(qualifier: string | null, isInclude: boolean): boolean {
  return (
    qualifier === null || qualifier === '+' || (!isInclude && qualifier === '?')
  );
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
  const result = await walk(domain, record, resolve, {
    left: MAX_SPF_LOOKUPS,
    isInclude: false,
  });
  return {
    status: result.status,
    lookupsLeft: result.left,
    records: result.records,
  };
}

/** Adds the record itself to the invalid ones when its status is not valid. */
function withRecord(domain: string, record: string, outcome: Walk): Walk {
  return outcome.status === 'valid'
    ? outcome
    : { ...outcome, records: [...outcome.records, { domain, record }] };
}

async function walk(
  domain: string,
  record: string,
  resolve: SpfResolver,
  state: { left: number; isInclude: boolean },
): Promise<Walk> {
  const parsed = parseSpf(record);

  if (!parsed) {
    return withRecord(domain, record, {
      status: 'invalid_syntax',
      left: state.left,
      records: [],
    });
  }
  if (parsed.terms.length === 0) {
    // No terms at all: the default result is `?all`, which is neutral.
    return withRecord(domain, record, {
      status: 'invalid_all',
      left: state.left,
      records: [],
    });
  }
  const allIndex = parsed.terms.findIndex((term) => term.kind === 'all');
  const allFound = allIndex !== -1;
  // Terms after the first `all` are never evaluated.
  const evaluated = allFound ? parsed.terms.slice(0, allIndex) : parsed.terms;
  const includes = evaluated.filter((term) => term.kind === 'include');
  const redirects = evaluated.filter((term) => term.kind === 'redirect');
  const left =
    state.left - evaluated.filter((term) => LOOKUP_KINDS.has(term.kind)).length;
  const allTerm = allFound ? parsed.terms[allIndex] : null;

  const startStatus = ((): SpfPolicyStatus => {
    if (allTerm !== null && isInvalidAll(allTerm.qualifier, state.isInclude)) {
      return 'invalid_all';
    }
    // Neither `all` nor `redirect`: the default is `?all`.
    if (!state.isInclude && redirects.length === 0 && !allFound) {
      return 'invalid_all';
    }
    // Deliberate tightening of the original, which only noticed an exceeded
    // limit when it reached an include or redirect: a record needing more
    // than ten lookups is ineffective whatever its terms are.
    return left < 0 ? 'max_dns_lookups' : 'valid';
  })();

  // Redirects are followed after includes, but only the first one and never
  // when `all` is present.
  const targets = [...includes, ...(allFound ? [] : redirects.slice(0, 1))];
  // One target after the other, each with the lookups the one before left;
  // the first bad result stops the rest.
  const followAll = async (
    remaining: typeof targets,
    current: Walk,
  ): Promise<Walk> => {
    const [term, ...others] = remaining;
    if (remaining.length === 0 || current.status !== 'valid') {
      return current;
    }
    const followed = await follow(
      term.value ?? '',
      resolve,
      current.left,
      term.kind === 'redirect' ? 'invalid_redirect' : 'invalid_include',
      term.kind !== 'redirect',
    );
    return followAll(others, {
      status: followed.status,
      left: followed.left,
      records: [...current.records, ...followed.records],
    });
  };
  return withRecord(
    domain,
    record,
    await followAll(targets, { status: startStatus, left, records: [] }),
  );
}

/** Follows an `include` or `redirect` and maps a bad result to `badStatus`. */
async function follow(
  target: string,
  resolve: SpfResolver,
  left: number,
  badStatus: SpfPolicyStatus,
  isInclude: boolean,
): Promise<Walk> {
  if (left < 0) {
    return { status: 'max_dns_lookups', left, records: [] };
  }
  // Macros cannot be expanded without a real message, so they are not followed.
  if (target.includes('{')) {
    return { status: 'valid', left, records: [] };
  }
  const next = await resolve(target).catch(() => null);
  if (next === null) {
    return { status: badStatus, left, records: [] };
  }
  const inner = await walk(target, next, resolve, { left, isInclude });
  const status =
    inner.status !== 'valid' && inner.status !== 'max_dns_lookups'
      ? badStatus
      : inner.status;
  return { status, left: inner.left, records: inner.records };
}
