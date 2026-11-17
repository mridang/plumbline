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
import { isObject } from '../wellknown/json.js';
import { parseCspLoose } from './csp.js';
import { finding } from './finding.js';
import { isThirdParty } from './registrable-domain.js';
import type { Finding } from './finding.js';

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
const CLOUDFLARE_NEL = /(^|\.)nel\.cloudflare\.com$/iu;

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
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is Group => isObject(entry))
      : null;
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
  return groups
    .filter((group) => group.group === name)
    .flatMap((group): unknown[] =>
      Array.isArray(group.endpoints) ? group.endpoints : [],
    )
    .flatMap((endpoint) => {
      const url =
        isObject(endpoint) && typeof endpoint.url === 'string'
          ? endpoint.url
          : '';
      return isThirdParty(url, registrable) &&
        !isPlatformEndpoint(url, cloudflare)
        ? [url]
        : [];
    });
}

/** Third-party endpoints of the report group named by the NEL header. */
function nelEndpoints(input: ReportingInput, groups: Group[]): string[] {
  if (input.nel === null) {
    return [];
  }
  try {
    const nel: unknown = JSON.parse(input.nel);
    if (isObject(nel) && 'report_to' in nel) {
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
  const csp = parseCspLoose(input.csp);
  const reportOnly = parseCspLoose(input.cspReportOnly);
  const groups = input.reportTo === null ? null : parseGroups(input.reportTo);

  const reportUri = (policy: Map<string, string[]>): string[] =>
    (policy.get('report-uri') ?? []).filter(
      (url) =>
        isThirdParty(url, input.registrable) &&
        !isPlatformEndpoint(url, input.cloudflare),
    );
  const reportTo = (group: string | undefined): string[] =>
    groups && group !== undefined
      ? thirdPartyEndpoints(groups, group, input.registrable, input.cloudflare)
      : [];
  const uriHeader = reportUri(csp);
  const uriReportOnly = reportUri(reportOnly);
  const toHeader = reportTo(csp.get('report-to')?.[0]);
  const toReportOnly = reportTo(reportOnly.get('report-to')?.[0]);
  const nelUrls = groups ? nelEndpoints(input, groups) : [];
  return {
    ...(uriHeader.length > 0 && { cspReportUri: uriHeader }),
    ...(uriReportOnly.length > 0 && { cspReportOnlyReportUri: uriReportOnly }),
    ...(toHeader.length > 0 && { cspReportTo: toHeader }),
    ...(toReportOnly.length > 0 && { cspReportOnlyReportTo: toReportOnly }),
    ...(nelUrls.length > 0 && { nel: nelUrls }),
  };
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Object.keys is typed string[]; LABELS is declared as Record<keyof ExternalReports, string>, so its keys are exactly that union
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
