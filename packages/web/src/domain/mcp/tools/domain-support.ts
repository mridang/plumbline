/**
 * @packageDocumentation
 *
 * What the tools that act on one of the user's domains share: reading the
 * `domain` argument, finding the domain it names, and naming a report.
 *
 * Finding a domain has to behave the same whether the assistant is reading one
 * or changing it, so it lives here rather than in whichever tool needed it
 * first.
 */

import { isDomainId, parseHost } from '@/domain/api/domain-resource';
import { isReportId } from '@/domain/api/report-resource';
import { type Database } from '@/domain/db/client';
import { type Domain, findDomainByHost, getDomain } from '@/domain/db/domains';
import { getReport, latestReport } from '@/domain/db/reports';
import { type User } from '@/domain/db/users';
import {
  errorResult,
  stringArg,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';

/** A domain argument read as a host, or the answer to give when it is not one. */
export type HostOrRefusal =
  { readonly host: string } | { readonly refusal: ToolResult<never> };

/** The host a `domain` argument names. */
export function hostOf(args: ToolArgs): HostOrRefusal {
  const parsed = parseHost(args['domain'], 'domain');
  return parsed.ok
    ? { host: parsed.value }
    : { refusal: errorResult(parsed.errors.join(' ')) };
}

/**
 * One of the user's domains by the `domain` argument (a host, a URL on it or
 * the domain's id), or the answer to give when they have none like it.
 */
export async function ownDomain(
  db: Database,
  user: Readonly<User>,
  args: ToolArgs,
): Promise<
  { readonly domain: Domain } | { readonly refusal: ToolResult<never> }
> {
  const raw = stringArg(args['domain']);
  if (isDomainId(raw)) {
    const byId = await getDomain(db, user.id, raw);
    if (byId) {
      return { domain: byId };
    }
  }
  const host = hostOf(args);
  if ('refusal' in host) {
    return host;
  }
  const domain = await findDomainByHost(db, user.id, host.host);
  return domain
    ? { domain }
    : {
        refusal: errorResult(
          `${host.host} is not one of the user's domains. Use list_domains to see them.`,
        ),
      };
}

/** The newest report when no id is given, otherwise the one the id names. */
export async function namedReport(
  db: Database,
  userId: number,
  domainId: string,
  id: string,
) {
  if (id === '') {
    return latestReport(db, userId, domainId);
  }
  return isReportId(id) ? getReport(db, userId, domainId, id) : undefined;
}

/** How the person runs the checks themselves, which a refusal points them at. */
export const CLI_COMMAND = 'npx @mridang/plumbline scan';
