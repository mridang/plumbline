/**
 * Reporting endpoints that point at third parties, a port of Webbkoll's
 * `external_report`. A Content Security Policy `report-uri` or `report-to`
 * (also in the report-only header) and a Network Error Logging policy tell
 * the browser to send reports, with the visitor's URL and details, to the
 * endpoint; when that endpoint is on another registrable domain, visitor data
 * leaves the site.
 *
 * One exception: a site served through Cloudflare gets a `NEL` header and a
 * `Report-To` group injected by Cloudflare itself, pointing at
 * `*.nel.cloudflare.com`. The site's owner did not choose that endpoint and
 * cannot remove it without switching Network Error Logging off in their
 * Cloudflare account, so it is the hosting platform's own reporting and not
 * a third party they added. It is skipped when the response shows it came
 * through Cloudflare; the same endpoint on any other site is still reported.
 */
import { parseCspLoose } from './csp.js';
import { finding, type Finding } from './finding.js';
import { isThirdParty } from './registrable-domain.js';

export interface ReportingInput {
  /** Registrable domain of the page. */
  registrable: string;
  csp: string | null;
  cspReportOnly: string | null;
  nel: string | null;
  /** Raw `Report-To` header: a comma separated list of JSON groups. */
  reportTo: string | null;
  /** The response came through Cloudflare (its `server` or `cf-ray` header). */
  cloudflare?: boolean;
}

/** Cloudflare's own Network Error Logging collector, injected on proxied sites. */
const CLOUDFLARE_NEL = /(^|\.)nel\.cloudflare\.com$/i;

/** Whether an endpoint is Cloudflare's injected collector on a site served by Cloudflare. */
function isPlatformEndpoint(url: string, cloudflare = false): boolean {
  if (!cloudflare) {
    return false;
  }
  try {
    return CLOUDFLARE_NEL.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export interface ExternalReports {
  cspReportUri?: string[];
  cspReportOnlyReportUri?: string[];
  cspReportTo?: string[];
  cspReportOnlyReportTo?: string[];
  nel?: string[];
}

type Group = { group?: unknown; endpoints?: unknown };

function parseGroups(reportTo: string): Group[] | null {
  try {
    const parsed: unknown = JSON.parse(`[${reportTo}]`);
    return Array.isArray(parsed) ? (parsed as Group[]) : null;
  } catch {
    return null;
  }
}

/** Third-party endpoint URLs of the named group of a `Report-To` header. */
function thirdPartyEndpoints(
  groups: Group[],
  name: unknown,
  registrable: string,
  cloudflare = false,
): string[] {
  const urls: string[] = [];
  for (const group of groups) {
    if (group?.group !== name || !Array.isArray(group.endpoints)) {
      continue;
    }
    for (const endpoint of group.endpoints as { url?: unknown }[]) {
      const url = typeof endpoint?.url === 'string' ? endpoint.url : '';
      if (
        isThirdParty(url, registrable) &&
        !isPlatformEndpoint(url, cloudflare)
      ) {
        urls.push(url);
      }
    }
  }
  return urls;
}

/** Third-party endpoints of the report group named by the NEL header. */
function nelEndpoints(input: ReportingInput, groups: Group[]): string[] {
  if (input.nel === null) {
    return [];
  }
  try {
    const nel = JSON.parse(input.nel) as { report_to?: unknown };
    if (nel && typeof nel === 'object' && 'report_to' in nel) {
      return thirdPartyEndpoints(
        groups,
        nel.report_to,
        input.registrable,
        input.cloudflare,
      );
    }
  } catch {
    // An NEL header that is not JSON is ignored by browsers too.
  }
  return [];
}

/** Finds the reporting endpoints on other registrable domains. */
export function externalReports(input: ReportingInput): ExternalReports {
  const found: ExternalReports = {};
  const csp = parseCspLoose(input.csp);
  const reportOnly = parseCspLoose(input.cspReportOnly);
  const groups = input.reportTo === null ? null : parseGroups(input.reportTo);

  const reportUri = (policy: Map<string, string[]>): string[] =>
    (policy.get('report-uri') ?? []).filter(
      (url) =>
        isThirdParty(url, input.registrable) &&
        !isPlatformEndpoint(url, input.cloudflare),
    );
  const uriHeader = reportUri(csp);
  if (uriHeader.length > 0) {
    found.cspReportUri = uriHeader;
  }
  const uriReportOnly = reportUri(reportOnly);
  if (uriReportOnly.length > 0) {
    found.cspReportOnlyReportUri = uriReportOnly;
  }

  if (groups) {
    const toHeader = csp.get('report-to')?.[0];
    if (toHeader !== undefined) {
      const urls = thirdPartyEndpoints(
        groups,
        toHeader,
        input.registrable,
        input.cloudflare,
      );
      if (urls.length > 0) {
        found.cspReportTo = urls;
      }
    }
    const toReportOnly = reportOnly.get('report-to')?.[0];
    if (toReportOnly !== undefined) {
      const urls = thirdPartyEndpoints(
        groups,
        toReportOnly,
        input.registrable,
        input.cloudflare,
      );
      if (urls.length > 0) {
        found.cspReportOnlyReportTo = urls;
      }
    }
    const nelUrls = nelEndpoints(input, groups);
    if (nelUrls.length > 0) {
      found.nel = nelUrls;
    }
  }
  return found;
}

const LABELS: Record<keyof ExternalReports, string> = {
  cspReportUri: "the 'report-uri' of the Content-Security-Policy header",
  cspReportOnlyReportUri:
    "the 'report-uri' of the Content-Security-Policy-Report-Only header",
  cspReportTo: "the 'report-to' group of the Content-Security-Policy header",
  cspReportOnlyReportTo:
    "the 'report-to' group of the Content-Security-Policy-Report-Only header",
  nel: "the 'NEL' (Network Error Logging) header",
};

/** One finding per place that reports to a third party. */
export function reportingFindings(input: ReportingInput): Finding[] {
  const reports = externalReports(input);
  return (Object.keys(LABELS) as (keyof ExternalReports)[]).flatMap((key) => {
    const urls = reports[key];
    return urls
      ? [
          finding(
            'error',
            `Violation or error reports from ${LABELS[key]} are sent to a third party: ${urls.join(', ')}.`,
          ),
        ]
      : [];
  });
}
