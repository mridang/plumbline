/**
 * @packageDocumentation
 *
 * The reports API as controllers over the `core/api` framework: the saved
 * outcome of each scan of one of the signed-in person's domains. A scan runs in
 * the person's browser, which posts the outcome here once every check has run;
 * only the newest few of each domain are kept (see `db/reports.ts`).
 *
 *   GET  /api/domains/{id}/reports              → 200, a page of reports
 *   POST /api/domains/{id}/reports {url, outcomes} → 201 + Location
 *   GET  /api/domains/{id}/reports/{report_id}  → 200
 */

import {
  ApiController,
  created,
  decodeCursor,
  ok,
  page,
  parseLimit,
  problems,
  readJsonObject,
  type CursorPosition,
} from '@/lib/core/api';
import {
  liveUid,
  requestCookieResolver,
  type CurrentUserResolver,
} from '@/domain/api/auth';
import { domainPath } from '@/domain/api/domains';
import { isDomainId } from '@/domain/api/domain-resource';
import {
  MAX_REPORT_BYTES,
  isReportId,
  parseReportInput,
  reportResource,
  type ReportInput,
} from '@/domain/api/report-resource';
import { getDatabase } from '@/domain/db/client';
import { getDomain, type Domain } from '@/domain/db/domains';
import { lastManualRunAt } from '@/domain/db/runs';
import { latestRuns } from '@/domain/db/suite';
import { secondsUntilNextRun, waitMessage } from '@/domain/scan/manual-run';
import {
  getReport,
  listReports,
  saveReport,
  type Report,
  type ReportSummary,
} from '@/domain/db/reports';

/** The signed-in caller's id and the domain the path names. */
interface DomainContext {
  readonly uid: number;
  readonly domainId: string;
}

/** The caller, the domain and the report the path names. */
interface ReportContext extends DomainContext {
  readonly reportId: string;
}

/** Responses about one person's reports are theirs alone. */
const PRIVATE = { 'Cache-Control': 'private, no-cache' } as const;

/** The path of a report. */
export function reportPath(domainId: string, reportId: string): string {
  return `${domainPath(domainId)}/reports/${reportId}`;
}

/** One of the caller's domains, or a thrown 404. */
async function ownedDomain(uid: number, id: string): Promise<Domain> {
  const domain = isDomainId(id)
    ? await getDomain(getDatabase(), uid, id)
    : undefined;
  if (!domain) {
    throw problems.notFound('domain');
  }
  return domain;
}

/**
 * A domain's reports: `GET` lists them a page at a time, newest first, without
 * their outcomes; `POST` saves the outcome of a scan that has just run (201).
 * 404 when the person has no domain with that id, 400 for a report that is not
 * well formed or names checks that do not exist, 413 for one over 1 MB, 429
 * (with `Retry-After`) for a second report within five minutes.
 */
export function createReportsCollection(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<DomainContext> {
  return new ApiController<DomainContext>({
    context: async (request, route) => {
      const uid = await liveUid(request, resolver);
      const params = await route.params;
      return { uid, domainId: params?.['id'] ?? '' };
    },
  })
    .on<
      { readonly limit: number; readonly after?: CursorPosition },
      {
        readonly items: readonly ReportSummary[];
        readonly next?: CursorPosition;
      }
    >({
      method: 'GET',
      decode: (request) => {
        const query = new URL(request.url).searchParams;
        const limit = parseLimit(query.get('limit'));
        if (limit instanceof Response) {
          throw limit;
        }
        const cursor = query.get('cursor');
        const after = cursor === null ? undefined : decodeCursor(cursor);
        if (cursor !== null && !after) {
          throw problems.badRequest('cursor: not one this API handed out.');
        }
        return after ? { limit, after } : { limit };
      },
      handle: async ({ limit, after }, { uid, domainId }) => {
        await ownedDomain(uid, domainId);
        // One more than a page, to know whether there is a next one.
        const found = await listReports(
          getDatabase(),
          uid,
          domainId,
          limit + 1,
          after ? { created_at: after.key, id: after.id } : undefined,
        );
        const items = found.slice(0, limit);
        const last = items.at(-1);
        return found.length > limit && last
          ? { items, next: { key: last.created_at, id: last.id } }
          : { items };
      },
      encode: ({ items, next }) => page(items, next, PRIVATE),
    })
    .on<Readonly<Record<string, unknown>>, Report>({
      method: 'POST',
      decode: async (request) => {
        const body = await readJsonObject(
          request,
          'The report must be a JSON object.',
          [],
          MAX_REPORT_BYTES,
        );
        if (!body.ok) {
          throw body.response;
        }
        return body.value;
      },
      handle: async (body, { uid, domainId }) => {
        const domain = await ownedDomain(uid, domainId);
        const input = parseReportInput(body, domain.host);
        if (!input.ok) {
          throw problems.badRequest('The report is not valid.', input.errors);
        }
        const report: ReportInput = input.value;
        const db = getDatabase();
        // One run by hand per site every five minutes: a report that would
        // be a second one is refused, whatever started it.
        const wait = secondsUntilNextRun(
          await lastManualRunAt(db, uid, domain.id),
          Date.now(),
        );
        if (wait > 0) {
          throw problems.rateLimited(waitMessage(wait), wait);
        }
        // The report is for the commit the site was last known to be at.
        const latest = await latestRuns(db, uid, domain.host, 1);
        const sha = latest[0]?.sha ?? null;
        return saveReport(db, uid, domain.id, report, sha);
      },
      encode: (report) =>
        created(
          reportResource(report),
          reportPath(report.domain_id, report.id),
        ),
    });
}

/** The reports collection bound to the production resolver. */
export const reportsCollection = createReportsCollection();

/**
 * One report, with every check's outcome. 404 when the person has no domain
 * with that id, or the domain has no report with that id.
 */
export function createReportItem(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<ReportContext> {
  return new ApiController<ReportContext>({
    context: async (request, route) => {
      const params = await route.params;
      return {
        uid: await liveUid(request, resolver),
        domainId: params?.['id'] ?? '',
        reportId: params?.['report-id'] ?? '',
      };
    },
  }).on<null, Report>({
    method: 'GET',
    handle: async (_input, { uid, domainId, reportId }) => {
      const report =
        isDomainId(domainId) && isReportId(reportId)
          ? await getReport(getDatabase(), uid, domainId, reportId)
          : undefined;
      if (!report) {
        throw problems.notFound('report');
      }
      return report;
    },
    encode: (report) => ok(reportResource(report), { headers: PRIVATE }),
  });
}

/** The report item controller bound to the production resolver. */
export const reportItem = createReportItem();
