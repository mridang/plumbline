/**
 * The `privacy` check set: the Webbkoll visitor-privacy hints a Lighthouse
 * *plugin* can run from the artifacts Lighthouse already gathers. Each check
 * reshapes the devtools log (via the `NetworkRecords` computed artifact, the
 * same seam the header checks read through) into the small structural input the
 * shared `src/lib/privacy/**` function takes — `classifyRequests` for requests
 * and `summarizeCookies` for cookies — and calls that exact function, so a site
 * yields the same findings here as under the webhint hint.
 *
 * Four hints are covered, each in the section the taxonomy
 * (`src/core/taxonomy.ts` PLACEMENT) assigns it — the cookie and third-party
 * inventories under `privacy`, and the two TLS concerns under
 * `https` (with `privacy` as a tag). The section is read from the
 * hint, never re-decided here:
 *
 *  - privacy-cookies (privacy) — counts first/third-party cookies.
 *  - privacy-third-party-requests (privacy) — requests to other domains.
 *  - privacy-mixed-content (https) — insecure subresources of an https page.
 *  - privacy-insecure-first-party (https) — plain-http same-domain requests.
 *
 * Scoring mirrors the webhint severity. `privacy-mixed-content` and
 * `privacy-insecure-first-party` report real `error`s (a security failure the
 * plugin fully observes), so they are graded (`numeric`). `privacy-cookies` and
 * `privacy-third-party-requests` are informational inventories — their baseline
 * severity is `hint`, rising to `warning` only to flag that third-party cookies
 * or requests exist, which is true of almost every site — so they are
 * `informative`: surfaced but never scored.
 *
 * NOT implementable as a plugin (left to the webhint hints / a future
 * gatherer): privacy-geolocation and privacy-local-storage both read runtime
 * JavaScript state through `context.evaluate` (the Geolocation API usage and
 * `localStorage`/`sessionStorage` contents), which Lighthouse's static
 * artifacts do not provide. They stay gatherer/runtime-only.
 */
import { finding } from '@mridang/webhint-hint-plumbline/dist/lib/headers/finding.js';
import {
  describeCookie,
  summarizeCookies,
  type CookieRecord,
} from '@mridang/webhint-hint-plumbline/dist/lib/privacy/cookies.js';
import { classifyRequests } from '@mridang/webhint-hint-plumbline/dist/lib/privacy/requests.js';
import type { HintDefinition } from '@mridang/webhint-hint-plumbline/dist/core/define-hint.js';
import { privacyNetwork } from '../adapt-privacy.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';

// The compiled webhint hints, imported only for their metadata (name,
// description, reference, section); the check logic is reused through the
// `src/lib/privacy/**` functions above, not through these modules.
import privacyCookiesHint from '@mridang/webhint-hint-plumbline/dist/hints/privacy/privacy-cookies.js';
import privacyInsecureFirstPartyHint from '@mridang/webhint-hint-plumbline/dist/hints/privacy/privacy-insecure-first-party.js';
import privacyMixedContentHint from '@mridang/webhint-hint-plumbline/dist/hints/privacy/privacy-mixed-content.js';
import privacyThirdPartyRequestsHint from '@mridang/webhint-hint-plumbline/dist/hints/privacy/privacy-third-party-requests.js';

/** The artifact set every privacy check reads. */
const PRIVACY_ARTIFACTS = ['DevtoolsLog', 'URL'] as const;

/**
 * Builds a check that borrows its metadata (title, description, reference and
 * the taxonomy section) from a compiled webhint hint, so none of it is restated
 * here. Mirrors the `fromHint` helper in `headers.ts`.
 */
function fromHint(
  definition: HintDefinition,
  config: Pick<AuditCheck, 'scoreMode' | 'run'>,
): AuditCheck {
  const docs = hintDocs(definition);
  return {
    id: definition.id,
    // Every privacy hint is placed in `privacy`; fall back defensively
    // rather than emit an empty group.
    section: docs.section ?? 'privacy',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode: config.scoreMode,
    requiredArtifacts: PRIVACY_ARTIFACTS,
    run: config.run,
  };
}

/** A sentence listing cookies with their attributes, empty for none. */
function list(label: string, cookies: readonly CookieRecord[]): string {
  return cookies.length === 0
    ? ''
    : ` ${label}: ${cookies.map((cookie) => describeCookie(cookie)).join('; ')}.`;
}

/** The host of the page URL, or null when it cannot be parsed. */
function hostOf(pageUrl: string): string | null {
  try {
    return new URL(pageUrl).hostname;
  } catch {
    return null;
  }
}

/** The four privacy checks, in report order. */
export const privacyChecks: readonly AuditCheck[] = [
  // Webbkoll "Cookies": count first/third-party cookies and list the
  // third-party domains. Informational (never scored); a warning when any
  // third-party cookie is present, otherwise a hint — matching the hint.
  fromHint(privacyCookiesHint, {
    scoreMode: 'informative',
    run: async (artifacts, context) => {
      const net = await privacyNetwork(artifacts, context);
      if (!net) {
        return null;
      }
      const pageHost = hostOf(net.pageUrl);
      if (pageHost === null) {
        return null;
      }
      const summary = summarizeCookies(net.cookies, pageHost);
      const first = summary.firstParty.length;
      const third = summary.thirdParty.length;
      if (first + third === 0) {
        // No cookies were set: nothing to surface (the hint does not report).
        return [];
      }
      const domains = summary.thirdPartyDomains;
      const message =
        `${first} first-party and ${third} third-party cookies were set` +
        (third > 0
          ? `; third-party cookie domains (${domains.length}): ${domains.join(', ')}`
          : '') +
        '.' +
        list('First-party cookies', summary.firstParty) +
        list('Third-party cookies', summary.thirdParty);
      return [finding(third > 0 ? 'warning' : 'hint', message)];
    },
  }),

  // Webbkoll "Third-party requests": list requests to hosts outside the page's
  // registrable domain. Informational; a warning when any are insecure.
  fromHint(privacyThirdPartyRequestsHint, {
    scoreMode: 'informative',
    run: async (artifacts, context) => {
      const net = await privacyNetwork(artifacts, context);
      if (!net) {
        return null;
      }
      const result = classifyRequests(net.pageUrl, net.requests);
      const total = result.thirdParty.length;
      if (total === 0) {
        return [];
      }
      const types = Object.entries(result.byType)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
      const message =
        `${total} third-party ${total === 1 ? 'request' : 'requests'} ` +
        `(${result.secure} secure, ${result.insecure} insecure) to ` +
        `${result.thirdPartyHosts.length} unique ` +
        `${result.thirdPartyHosts.length === 1 ? 'host' : 'hosts'}: ` +
        `${result.thirdPartyHosts.join(', ')}. By type: ${types}. ` +
        `A third-party request is a request to a domain that is not ` +
        `${result.pageDomain} or one of its subdomains.`;
      return [finding(result.insecure > 0 ? 'warning' : 'hint', message)];
    },
  }),

  // Webbkoll "Mixed content": an https page must not load http subresources.
  // Active content (scripts, styles, frames, fonts) is an error; passive
  // content (images, media) is a warning. Graded (`numeric`). The plugin sees
  // the requests that were made, not URLs only declared in the HTML, so it
  // reports the fetched resources (the webhint hint also folds in declarations).
  fromHint(privacyMixedContentHint, {
    scoreMode: 'numeric',
    run: async (artifacts, context) => {
      const net = await privacyNetwork(artifacts, context);
      if (!net) {
        return null;
      }
      const { mixedContent } = classifyRequests(net.pageUrl, net.requests);
      return [
        ...mixedContent.active.map((request) =>
          finding(
            'error',
            `The page contains active mixed content: ${request.type} loaded over http from ${request.url}`,
          ),
        ),
        ...mixedContent.passive.map((request) =>
          finding(
            'warning',
            `The page contains passive mixed content: ${request.type} loaded over http from ${request.url}`,
          ),
        ),
      ];
    },
  }),

  // Webbkoll "Insecure first-party requests": every plain-http request to the
  // page's own registrable domain is an error. Graded (`numeric`).
  fromHint(privacyInsecureFirstPartyHint, {
    scoreMode: 'numeric',
    run: async (artifacts, context) => {
      const net = await privacyNetwork(artifacts, context);
      if (!net) {
        return null;
      }
      const { insecureFirstParty } = classifyRequests(
        net.pageUrl,
        net.requests,
      );
      return insecureFirstParty.map((request) =>
        finding('error', `Insecure first-party request: ${request.url}`),
      );
    },
  }),
];
