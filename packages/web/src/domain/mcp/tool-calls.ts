/**
 * @packageDocumentation
 *
 * What the MCP tools do. Every call is checked against its tool's input schema
 * first (see `tool-definitions.ts`), then runs against the user's own rows in
 * the database: the same repositories the REST API uses, so the two can never
 * disagree. The database is passed in, so the tools are tested against a real
 * SQLite database.
 *
 * Nothing here runs a check. The checks run in a browser or with the CLI, and
 * `scan_domain` says how; the tools read and change the domains and read the
 * reports those scans saved.
 */

import {
  InvalidToolArgumentsError,
  UnknownToolError,
  canonicalArguments,
  isJsonObject,
  numberArg,
  offsetArg,
  stringArg,
  stringListArg,
  validateJson,
  BackendFailureError,
  type JsonSchema,
} from '@/lib/mcp';
import { overviewOf } from '@/domain/db/live';
import { errorMessage, logError } from '@/utils/logging';
import type { User } from '@/domain/db/users';
import { getDatabase, type Database } from '@/domain/db/client';
import {
  deleteDomain,
  findDomainByHost,
  getDomain,
  listDomains,
  setDomainChecks,
  type Domain,
} from '@/domain/db/domains';
import {
  deleteReportsOf,
  getReport,
  latestReport,
  listReports,
} from '@/domain/db/reports';
import {
  CHECKS,
  GROUPS,
  isGroup,
  applyChoice,
  checksInGroup,
  enabledChecks,
  expandSelection,
} from '@/domain/checks/catalogue';
import { isDomainId, parseHost } from '@/domain/api/domain-resource';
import { isReportId } from '@/domain/api/report-resource';
import {
  CHECKS_PAGE_DEFAULT,
  CHECKS_PAGE_MAX,
  toolNamed,
  type ToolName,
} from '@/domain/mcp/tool-definitions';
import {
  checkName,
  domainLink,
  domainListResult,
  errorResult,
  reportResult,
  tallyLine,
  textResult,
  type ToolResult,
} from '@/domain/mcp/tool-results';
import { SITE_URL } from '@/utils/site';
import { countOf } from '@/lib/intl';

/** The arguments of a call, once checked. */
type Args = Readonly<Record<string, unknown>>;

/** How the CLI is run, for the answer to `scan_domain`. */
export const CLI_COMMAND = 'npx @mridang/plumbline scan';

/** A domain argument read as a host, or the answer to give when it is not one. */
type HostOrRefusal =
  { readonly host: string } | { readonly refusal: ToolResult };

/** The host a `domain` argument names. */
function hostOf(args: Args): HostOrRefusal {
  const parsed = parseHost(args['domain'], 'domain');
  return parsed.ok
    ? { host: parsed.value }
    : { refusal: errorResult(parsed.errors.join(' ')) };
}

/**
 * One of the user's domains by the `domain` argument (a host, a URL on it or
 * the domain's id), or the answer to give when they have none like it.
 */
async function ownDomain(
  db: Database,
  user: Readonly<User>,
  args: Args,
): Promise<{ readonly domain: Domain } | { readonly refusal: ToolResult }> {
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

/** `list_checks`: the groups first, then a page of checks. */
function listChecks(args: Args): ToolResult {
  const group = stringArg(args['group']);
  if (group !== '' && !isGroup(group)) {
    return errorResult(
      `There is no group "${group.slice(0, 80)}". The groups are ${GROUPS.join(', ')}.`,
    );
  }
  const query = stringArg(args['query']).toLowerCase();
  const pool = (group === '' ? CHECKS : checksInGroup(group)).filter(
    (check) =>
      query === '' ||
      `${check.id} ${check.name} ${check.description}`
        .toLowerCase()
        .includes(query),
  );
  // Not limitArg: it caps every tool at 50, and a page of checks may hold more.
  const asked = numberArg(args['limit']);
  const limit = Math.min(
    asked === undefined ? CHECKS_PAGE_DEFAULT : Math.max(Math.floor(asked), 1),
    CHECKS_PAGE_MAX,
  );
  const offset = offsetArg(args['offset']);
  const page = pool.slice(offset, offset + limit);
  const groupText = group ? ` in ${group}` : '';
  const queryText = query ? ` matching "${query}"` : '';
  const lines = [
    ...(group === '' && query === '' && offset === 0
      ? [`Groups: ${GROUPS.join(', ')}.`, '']
      : []),
    `${countOf(pool.length, 'check')}${groupText}${queryText}; showing ${page.length} from ${offset}.`,
    ...page.map(
      (check) =>
        `- ${check.id}: ${check.name} [${check.groups.join(', ')}] ${check.description}`,
    ),
  ];
  if (offset + page.length < pool.length) {
    lines.push(`More: call again with offset ${offset + page.length}.`);
  }
  return textResult(lines.join('\n'));
}

/** `list_domains`: every domain with its check count and newest scan. */
async function listDomainsTool(
  db: Database,
  user: Readonly<User>,
): Promise<ToolResult> {
  const domains = await listDomains(db, user.id);
  const rows = await Promise.all(
    domains.map(async (domain) => {
      const [latest] = await listReports(db, user.id, domain.id, 1);
      return {
        domain,
        checks: enabledChecks(domain.checks).length,
        ...(latest ? { latest } : {}),
      };
    }),
  );
  return domainListResult(rows, CHECKS.length);
}

/** `list_repositories`: what the person's dashboard shows, as text. */
async function listRepositoriesTool(
  db: Database,
  user: Readonly<User>,
): Promise<ToolResult> {
  const repos = await overviewOf(db, user.id);
  if (repos.length === 0) {
    return textResult(
      'No repositories yet. Connect GitHub on Plumbline to see the sites of the repositories you have access to.',
    );
  }
  const lines = repos.flatMap((repo) => [
    `${repo.repo ?? 'Added by hand'}:`,
    ...repo.sites.map(
      (site) =>
        `  ${site.host}: ${site.state} (${site.errors} errors, ${site.warnings} warnings, ${site.hints} hints)`,
    ),
  ]);
  return textResult(lines.join('\n'));
}

/** `get_domain`: which checks run, which are off, and the newest scan. */
async function getDomainTool(
  db: Database,
  user: Readonly<User>,
  domain: Readonly<Domain>,
): Promise<ToolResult> {
  const on = enabledChecks(domain.checks);
  const off = CHECKS.filter((check) => !on.includes(check.id));
  const offMore = off.length > 100 ? `, and ${off.length - 100} more` : '';
  const [latest] = await listReports(db, user.id, domain.id, 1);
  return textResult(
    [
      `${domain.host} (id ${domain.id}), added ${domain.created_at}.`,
      domain.checks === null
        ? `Every check runs (${CHECKS.length}).`
        : `${on.length} of ${CHECKS.length} checks run.`,
      ...(off.length > 0
        ? [
            `Switched off: ${off
              .slice(0, 100)
              .map((check) => check.id)
              .join(', ')}${offMore}.`,
          ]
        : []),
      latest
        ? `Newest scan ${latest.created_at}: ${tallyLine(latest)}.`
        : 'Not scanned yet.',
      `Page: ${domainLink(domain)}`,
    ].join('\n'),
  );
}

/** The newest report when no id is given, otherwise the one the id names. */
async function namedReport(
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

/** `get_report`: the newest report, or the one `report` names. */
async function getReportTool(
  db: Database,
  user: Readonly<User>,
  domain: Readonly<Domain>,
  args: Args,
): Promise<ToolResult> {
  const id = stringArg(args['report']);
  const report = await namedReport(db, user.id, domain.id, id);
  if (!report) {
    return id === ''
      ? errorResult(
          `${domain.host} has not been scanned yet. Use scan_domain to see how to scan it.`,
        )
      : errorResult(
          `${domain.host} has no report with that id. Use list_reports to see them.`,
        );
  }
  return reportResult(domain, report);
}

/** `list_reports`: the saved reports, newest first. */
async function listReportsTool(
  db: Database,
  user: Readonly<User>,
  domain: Readonly<Domain>,
): Promise<ToolResult> {
  const reports = await listReports(db, user.id, domain.id, 100);
  return textResult(
    reports.length === 0
      ? `${domain.host} has no saved reports yet.`
      : [
          `${countOf(reports.length, 'report')} for ${domain.host}, newest first:`,
          ...reports.map(
            (report) =>
              `- ${report.id} (${report.created_at}): ${tallyLine(report)}`,
          ),
        ].join('\n'),
  );
}

/** `scan_domain`: where and how the checks for a domain run. */
function scanDomainTool(domain: Readonly<Domain>): ToolResult {
  return textResult(
    [
      `The checks for ${domain.host} run outside this server.`,
      `- In the browser: open ${domainLink(domain)} and press "Run checks". It runs the checks chosen for the domain and saves a report, which get_report then reads.`,
      `- On the user's machine: \`${CLI_COMMAND} ${domain.host}\` runs every check, TLS and mail included, and prints the findings (add \`--format json\` for machine-readable output).`,
    ].join('\n'),
  );
}

/** `remove_domain`: remove it and its reports. */
async function removeDomainTool(
  db: Database,
  user: Readonly<User>,
  domain: Readonly<Domain>,
): Promise<ToolResult> {
  await deleteDomain(db, user.id, domain.id);
  await deleteReportsOf(db, user.id, domain.id);
  return textResult(`Removed ${domain.host} and its saved reports.`);
}

/** `configure_checks`: switch checks or groups on and off. */
async function configureChecksTool(
  db: Database,
  user: Readonly<User>,
  domain: Readonly<Domain>,
  args: Args,
): Promise<ToolResult> {
  const enable = expandSelection(stringListArg(args['enable']));
  const disable = expandSelection(stringListArg(args['disable']));
  const unknown = [...enable.unknown, ...disable.unknown];
  if (unknown.length > 0) {
    return errorResult(
      `Not a check or a group: ${unknown
        .slice(0, 10)
        .map((name) => `"${name.slice(0, 80)}"`)
        .join(', ')}. Use list_checks to see the ids and groups.`,
    );
  }
  const start = args['all'] === true ? null : domain.checks;
  const chosen = applyChoice(start, {
    enable: enable.ids,
    disable: disable.ids,
  });
  await setDomainChecks(db, user.id, domain.id, chosen);
  const count = enabledChecks(chosen).length;
  const changed = [
    ...enable.ids.slice(0, 5).map((id) => `on: ${checkName(id)}`),
    ...disable.ids.slice(0, 5).map((id) => `off: ${checkName(id)}`),
  ];
  const scope =
    chosen === null
      ? `every check (${count})`
      : `${count} of ${CHECKS.length} checks`;
  const more =
    enable.ids.length + disable.ids.length > changed.length ? ', and more' : '';
  const changedText =
    changed.length > 0 ? ` Changed ${changed.join('; ')}${more}.` : '';
  return textResult(`${domain.host} now runs ${scope}.${changedText}`);
}

/** The tools that act on one of the user's existing domains. */
const DOMAIN_TOOLS: Readonly<
  Partial<
    Record<
      ToolName,
      (
        db: Database,
        user: Readonly<User>,
        domain: Readonly<Domain>,
        args: Args,
      ) => Promise<ToolResult> | ToolResult
    >
  >
> = {
  get_domain: getDomainTool,
  get_report: getReportTool,
  list_reports: listReportsTool,
  // eslint-disable-next-line sonarjs/function-name -- the key is the scan_domain tool name the assistant calls
  scan_domain: (_db, _user, domain) => scanDomainTool(domain),
  remove_domain: removeDomainTool,
  configure_checks: configureChecksTool,
};

/** The arguments a tool takes, as one line the assistant can follow. */
function usage(schema: JsonSchema): string {
  const required = new Set(schema.required);
  const names = Object.keys(schema.properties ?? {}).map((key) =>
    required.has(key) ? `${key} (required)` : key,
  );
  return names.length > 0
    ? `The arguments are: ${names.join(', ')}.`
    : 'This tool takes no arguments.';
}

/** The arguments of a call that passed the check, or the answer to give when they did not. */
type Checked = { readonly args: Args } | { readonly refusal: ToolResult };

/**
 * The arguments of a call, checked against the tool's input schema. Arguments
 * that do not fit come back as an `isError` result naming each problem (the
 * spec lists input validation among tool execution errors).
 * @throws {InvalidToolArgumentsError} If `arguments` is not an object at all.
 */
function checkedArguments(
  tool: Readonly<{ name: string; inputSchema: JsonSchema }>,
  rawArgs: unknown,
): Checked {
  const given = rawArgs === undefined ? {} : rawArgs;
  if (!isJsonObject(given)) {
    throw new InvalidToolArgumentsError(['`arguments` must be an object.']);
  }
  const args = canonicalArguments(tool.name, given);
  const problems = validateJson(tool.inputSchema, args, 'The arguments');
  return problems.length > 0
    ? {
        refusal: errorResult(
          `Invalid arguments for ${tool.name}: ${problems.join(' ')} ${usage(tool.inputSchema)}`,
        ),
      }
    : { args };
}

/**
 * Execute a `tools/call` for `user`.
 * @param openDatabase - How the database is opened; tests pass their own.
 * @throws {UnknownToolError} If no such tool exists.
 * @throws {InvalidToolArgumentsError} If the request has no tool name, or its
 *   `arguments` is not an object.
 * @throws {BackendFailureError} If the database failed mid-call.
 */
export async function callTool(
  user: Readonly<User>,
  params: Args | undefined,
  openDatabase: () => Database = getDatabase,
): Promise<ToolResult> {
  const name: unknown = params?.['name'];
  if (typeof name !== 'string' || name === '') {
    throw new InvalidToolArgumentsError(['`name` must be the name of a tool.']);
  }
  const tool = toolNamed(name);
  if (!tool) {
    throw new UnknownToolError(name);
  }
  const checked = checkedArguments(
    tool as unknown as { name: string; inputSchema: JsonSchema },
    params?.['arguments'],
  );
  if ('refusal' in checked) {
    return checked.refusal;
  }
  const { args } = checked;
  if (tool.name === 'list_checks') {
    return listChecks(args);
  }
  const run = DOMAIN_TOOLS[tool.name];
  if (
    !run &&
    tool.name !== 'list_domains' &&
    tool.name !== 'list_repositories'
  ) {
    // Advertised but not implemented: a bug here, not something to tell the caller.
    throw new Error(`Tool ${tool.name} is listed but has no implementation.`);
  }
  try {
    const db = openDatabase();
    if (tool.name === 'list_domains') {
      return await listDomainsTool(db, user);
    }
    if (tool.name === 'list_repositories') {
      return await listRepositoriesTool(db, user);
    }
    if (!run) {
      throw new Error(`Tool ${tool.name} is listed but has no implementation.`);
    }
    const found = await ownDomain(db, user, args);
    return 'refusal' in found
      ? found.refusal
      : await run(db, user, found.domain, args);
  } catch (error) {
    throw new BackendFailureError('the database', error);
  }
}

/**
 * Run a `tools/call`, explaining a database failure in words the assistant can
 * pass on, as a tool error, instead of a protocol error. An unknown tool or a
 * malformed request is still thrown for the router to answer.
 */
export async function callToolOrExplain(
  user: Readonly<User>,
  params: Args | undefined,
  openDatabase?: () => Database,
): Promise<ToolResult> {
  try {
    return await callTool(user, params, openDatabase);
  } catch (error) {
    if (error instanceof BackendFailureError) {
      // What actually failed stays in our logs.
      logError({
        event: 'mcp.backend_failed',
        service: error.service,
        error: errorMessage(error.cause),
      });
      return errorResult(
        `Something went wrong with ${error.service}, so that did not work. Try again in a minute; if it keeps failing, tell the user to open ${SITE_URL}.`,
      );
    }
    throw error;
  }
}
