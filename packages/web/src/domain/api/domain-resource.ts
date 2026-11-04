/**
 * @packageDocumentation
 *
 * Domains on the wire: the representation `/api/domains` sends, and checking
 * what a client posts to add a domain or to choose its checks.
 */

import type { Domain } from '@/domain/db/domains';
import { enabledChecks, expandSelection } from '@/domain/checks/catalogue';
import { readTarget } from '@/domain/scan/target';

/** A domain as the API shows it. */
export interface DomainResource {
  readonly id: string;
  /** The host name, such as `example.com`. */
  readonly host: string;
  /** Whether every check runs (then `checks` lists them all, including ones added later). */
  readonly all_checks: boolean;
  /** The ids of the checks that run for the domain. */
  readonly checks: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
}

/** The API's view of a stored domain. */
export function domainResource(domain: Readonly<Domain>): DomainResource {
  return {
    id: domain.id,
    host: domain.host,
    all_checks: domain.checks === null,
    checks: enabledChecks(domain.checks),
    created_at: domain.created_at,
    updated_at: domain.updated_at,
  };
}

/** What checking an input came to: the value, or what was wrong with it. */
export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * The host a person typed (a bare domain or any URL on it), lower-cased and
 * without a trailing dot, or why it is not a public domain. The same rules as
 * scanning, so a domain that can be added can be scanned.
 */
export function parseHost(raw: unknown, field = 'host'): Parsed<string> {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, errors: [`${field}: required.`] };
  }
  const target = readTarget(raw);
  if (!target.ok) {
    return { ok: false, errors: [`${field}: ${target.reason}`] };
  }
  return { ok: true, value: target.url.hostname.replace(/\.$/, '') };
}

/** Check the body of `POST /api/domains`: a `host`. */
export function parseDomainInput(
  body: Readonly<Record<string, unknown>>,
): Parsed<string> {
  return parseHost(body['host']);
}

/** The longest list of check ids or groups taken in one request. */
const MAX_NAMES = 500;

/**
 * A list of check ids and group names, expanded to check ids, or what is wrong
 * with it: not a list of strings, too long, or naming something that is
 * neither a check nor a group.
 */
export function parseCheckNames(
  raw: unknown,
  field: string,
): Parsed<readonly string[]> {
  if (!Array.isArray(raw) || !raw.every((v) => typeof v === 'string')) {
    return {
      ok: false,
      errors: [`${field}: must be a list of check ids or group names.`],
    };
  }
  if (raw.length > MAX_NAMES) {
    return {
      ok: false,
      errors: [`${field}: at most ${MAX_NAMES} entries.`],
    };
  }
  const { ids, unknown } = expandSelection(raw.map((v: string) => v.trim()));
  return unknown.length > 0
    ? {
        ok: false,
        errors: unknown
          .slice(0, 10)
          .map(
            (name) =>
              `${field}: "${name.slice(0, 80)}" is not a check or a group.`,
          ),
      }
    : { ok: true, value: ids };
}

/**
 * Check the body of `PATCH /api/domains/{id}` (a JSON Merge Patch): `checks`
 * is the full list of checks to run (check ids or group names), or null for
 * every check. Nothing else of a domain can be changed.
 */
export function parseDomainPatch(
  body: Readonly<Record<string, unknown>>,
): Parsed<readonly string[] | null> {
  const unknownFields = Object.keys(body).filter((key) => key !== 'checks');
  if (unknownFields.length > 0) {
    return {
      ok: false,
      errors: unknownFields.map((key) => `${key}: cannot be changed.`),
    };
  }
  if (!Object.hasOwn(body, 'checks')) {
    return { ok: false, errors: ['checks: required.'] };
  }
  if (body['checks'] === null) {
    return { ok: true, value: null };
  }
  return parseCheckNames(body['checks'], 'checks');
}

/** Whether a path segment can be a domain id (the ids are UUIDs). */
export function isDomainId(raw: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
    raw,
  );
}
