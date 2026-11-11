import type { TxtLookup } from '../email/txt.js';
import type { Finding } from './finding.js';

/**
 * MTA-STS (RFC 8461) lets a domain tell sending mail servers that mail to it
 * must go over authenticated TLS. It has two parts that must agree:
 *
 * 1. A TXT record at `_mta-sts.<domain>` of the form `v=STSv1; id=<id>`, whose
 *    `id` changes whenever the policy changes (RFC 8461 section 3.1), and
 * 2. A policy file served over HTTPS at
 *    `https://mta-sts.<domain>/.well-known/mta-sts.txt` with the fields
 *    `version: STSv1`, `mode: enforce|testing|none`, one or more `mx:` MX host
 *    patterns and `max_age:` in seconds (RFC 8461 sections 3.2 and 3.3).
 *
 * The functions here are pure: the hint resolves DNS and fetches the policy,
 * then hands the results to {@link checkMtaSts}, so every branch is testable
 * without a network.
 */

/** The upper bound RFC 8461 section 3.2 places on `max_age` (seconds). */
export const MAX_AGE_LIMIT = 31_557_600;

/** The outcome of fetching the policy file over HTTPS. */
export type PolicyFetch =
  | { status: 'ok'; mediaType: string; body: string }
  /** The policy host was unreachable or answered 4xx/5xx. */
  | { status: 'missing' };

/** The host the policy file is served from for a domain (RFC 8461 3.2). */
export function policyHost(domain: string): string {
  return `mta-sts.${domain}`;
}

/** The canonical HTTPS URL of a domain's MTA-STS policy file. */
export function policyUrl(domain: string): string {
  return `https://${policyHost(domain)}/.well-known/mta-sts.txt`;
}

/** Keeps only the TXT records that declare an MTA-STS policy. */
function stsRecords(txt: TxtLookup): string[] {
  if (txt.status !== 'ok') {
    return [];
  }
  return txt.records.filter((record) =>
    record.trim().toLowerCase().startsWith('v=sts'),
  );
}

/** Parses `key=value; key=value` pairs, lower-casing the keys. */
function parsePairs(record: string): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const part of record.split(';')) {
    const trimmed = part.trim();
    if (trimmed === '') {
      continue;
    }
    const equals = trimmed.indexOf('=');
    const key = (equals === -1 ? trimmed : trimmed.slice(0, equals))
      .trim()
      .toLowerCase();
    const value = equals === -1 ? '' : trimmed.slice(equals + 1).trim();
    if (!pairs.has(key)) {
      pairs.set(key, value);
    }
  }
  return pairs;
}

/** Checks the `_mta-sts` TXT record alone; empty when it is well formed. */
function checkTxtRecord(record: string): Finding[] {
  const pairs = parsePairs(record);
  // The version tag must come first and be exactly STSv1 (RFC 8461 3.1).
  if (pairs.get('v') !== 'STSv1') {
    return [
      {
        message:
          'Your `_mta-sts` TXT record is *not* syntactically correct: it must start with `v=STSv1`.',
        severity: 'error',
        codeSnippet: record,
      },
    ];
  }
  const id = pairs.get('id') ?? '';
  // The id is 1*32 characters of ALPHA / DIGIT (RFC 8461 3.1).
  if (!/^[A-Za-z0-9]{1,32}$/u.test(id)) {
    return [
      {
        message:
          'Your `_mta-sts` TXT record is *not* syntactically correct: the `id` must be 1 to 32 letters or digits.',
        severity: 'error',
        codeSnippet: record,
      },
    ];
  }
  return [];
}

/**
 * Parses the policy file body into key/value fields. Lines are separated by
 * CRLF (RFC 8461 3.2); a bare LF is accepted too for leniency. `mx` may repeat
 * so every value is collected.
 */
function parsePolicy(body: string): {
  version?: string;
  mode?: string;
  maxAge?: string;
  mx: string[];
} {
  const result: {
    version?: string;
    mode?: string;
    maxAge?: string;
    mx: string[];
  } = { mx: [] };
  for (const line of body.split(/\r\n|\n/u)) {
    const colon = line.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'version' && result.version === undefined) {
      result.version = value;
    } else if (key === 'mode' && result.mode === undefined) {
      result.mode = value;
    } else if (key === 'max_age' && result.maxAge === undefined) {
      result.maxAge = value;
    } else if (key === 'mx') {
      result.mx.push(value);
    } else {
      // Other keys are not used by the check.
    }
  }
  return result;
}

/** Checks the fetched policy file; empty when every field is valid. */
function checkPolicyFile(policy: PolicyFetch): Finding[] {
  if (policy.status === 'missing') {
    return [
      {
        message:
          'Your domain publishes an MTA-STS TXT record but its policy file at the `mta-sts` host is *missing* or unreachable.',
        severity: 'error',
        codeSnippet: 'GET /.well-known/mta-sts.txt',
      },
    ];
  }
  const findings: Finding[] = [];
  // The policy file must be served as text/plain (RFC 8461 3.2).
  const mediaType = policy.mediaType.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'text/plain') {
    findings.push({
      message: `Your MTA-STS policy file is *not* served as \`text/plain\` (it is \`${policy.mediaType || 'unknown'}\`).`,
      severity: 'error',
      codeSnippet: `Content-Type: ${policy.mediaType || '(none)'}`,
    });
  }
  const parsed = parsePolicy(policy.body);
  if (parsed.version !== 'STSv1') {
    findings.push({
      message:
        'Your MTA-STS policy file is *not* valid: the `version` field must be `STSv1`.',
      severity: 'error',
      codeSnippet: policy.body,
    });
  }
  const mode = parsed.mode ?? '';
  if (mode !== 'enforce' && mode !== 'testing' && mode !== 'none') {
    findings.push({
      message:
        'Your MTA-STS policy file is *not* valid: `mode` must be `enforce`, `testing` or `none`.',
      severity: 'error',
      codeSnippet: `mode: ${mode || '(missing)'}`,
    });
  } else if (mode === 'testing') {
    // Testing mode reports failures but still delivers over plaintext, so it
    // does not yet protect mail (RFC 8461 2 and 5).
    findings.push({
      message:
        'Your MTA-STS policy is in `testing` mode, so TLS is *not* yet enforced for mail to your domain.',
      severity: 'warning',
      codeSnippet: 'mode: testing',
    });
  } else {
    // An enforcing policy needs no finding.
  }
  // A policy that enforces or tests must list at least one MX pattern; a
  // `none` policy (decommissioning) need not (RFC 8461 3.2).
  if (mode !== 'none' && parsed.mx.length === 0) {
    findings.push({
      message:
        'Your MTA-STS policy file is *not* valid: it lists no `mx` host patterns.',
      severity: 'error',
      codeSnippet: policy.body,
    });
  }
  const maxAge = Number(parsed.maxAge);
  if (
    parsed.maxAge === undefined ||
    !/^\d+$/u.test(parsed.maxAge) ||
    maxAge <= 0 ||
    maxAge > MAX_AGE_LIMIT
  ) {
    findings.push({
      message: `Your MTA-STS policy file is *not* valid: \`max_age\` must be a whole number of seconds between 1 and ${MAX_AGE_LIMIT}.`,
      severity: 'error',
      codeSnippet: `max_age: ${parsed.maxAge ?? '(missing)'}`,
    });
  }
  return findings;
}

/**
 * Validates a domain's MTA-STS setup from its `_mta-sts` TXT lookup and the
 * fetched policy file. A failed TXT lookup returns no findings (the hint stays
 * silent rather than guess). When neither part is present the domain simply
 * does not use MTA-STS, reported once as advice; otherwise every broken or
 * mismatched part is reported.
 */
export function checkMtaSts(
  domain: string,
  txt: TxtLookup,
  policy: PolicyFetch,
): Finding[] {
  if (txt.status === 'error') {
    return [];
  }
  const records = stsRecords(txt);
  const hasPolicy = policy.status === 'ok';

  // Nothing published at all: MTA-STS is recommended, not mandatory.
  if (records.length === 0 && !hasPolicy) {
    return [
      {
        message:
          'Your domain does *not* enable MTA-STS, so sending servers cannot require TLS for mail to you.',
        severity: 'warning',
        codeSnippet: `_mta-sts.${domain}. IN TXT "v=STSv1; id=20240101000000"`,
      },
    ];
  }

  const findings: Finding[] = [];
  if (records.length === 0) {
    findings.push({
      message:
        'Your domain serves an MTA-STS policy file but has *no* `_mta-sts` TXT record, so senders will not discover it.',
      severity: 'error',
      codeSnippet: `_mta-sts.${domain}. IN TXT "v=STSv1; id=20240101000000"`,
    });
  } else if (records.length > 1) {
    findings.push({
      message:
        'Your domain has *more than one* `_mta-sts` TXT record; there must be exactly one.',
      severity: 'error',
      codeSnippet: records.join('\n'),
    });
  } else {
    findings.push(...checkTxtRecord(records[0]));
  }

  findings.push(...checkPolicyFile(policy));
  return findings;
}
