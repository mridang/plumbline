/**
 * Adapters that turn Lighthouse artifacts into the small structural shapes the
 * webhint-hints `src/lib/**` pure functions expect. Nothing here re-implements
 * a check: each adapter only reshapes data so the existing analysers can run
 * unchanged.
 *
 * The library lives in the parent package and is consumed as its already
 * compiled JavaScript under `@mridang/webhint-hint-extra/dist/**` (the root build runs before this
 * package's build, exactly as the formatter package consumes it). Importing the
 * compiled output keeps this package's own `rootDir` at `src`, so the audits
 * still emit to `dist/audits/*.js` as the plugin manifest references them.
 */
// `NetworkRequest` lives inside the `Artifacts` namespace of Lighthouse's
// type-only artifacts module (there is no runtime file, so this is a type
// import). It is the record shape `NetworkRecords` yields.
import type { Artifacts } from 'lighthouse/types/artifacts.js';

type NetworkRequest = Artifacts.NetworkRequest;

// The header bag shape the header checks accept: values may repeat (an array).
import type { HeaderBag } from '@mridang/webhint-hint-extra/dist/lib/headers/http-headers.js';
// `metaContents` reads the `content` of matching `<meta>` tags; reused so the
// cross-origin audits read `<meta http-equiv>` exactly as the webhint hints do.
import { metaContents } from '@mridang/webhint-hint-extra/dist/lib/headers/http-headers.js';
// The structural DOM the Open Graph reader needs (querySelectorAll('meta')).
import type { MetaDocument } from '@mridang/webhint-hint-extra/dist/lib/opengraph/meta.js';

/**
 * Lighthouse's `MetaElements` artifact entry: one `<meta>` tag, already parsed
 * into its attributes. Mirrors `LH.Artifacts.MetaElement` without pulling the
 * whole artifact type in.
 */
export interface MetaElementArtifact {
  name?: string;
  property?: string;
  content?: string;
  httpEquiv?: string;
  charset?: string;
}

/**
 * Reads the main document out of the `NetworkRecords` computed artifact. The
 * main document is the last non-redirected `Document` request for the final
 * URL; when the URL is unknown it falls back to the first `Document` record.
 *
 * Source artifact: `DevtoolsLog` (via Lighthouse's `NetworkRecords` computed
 * artifact) plus `URL.mainDocumentUrl` / `URL.finalDisplayedUrl`.
 */
export function findMainDocument(
  records: readonly NetworkRequest[],
  mainDocumentUrl: string | undefined,
): NetworkRequest | null {
  const documents = records.filter(
    (record) => record.resourceType === 'Document',
  );
  if (mainDocumentUrl) {
    // The last matching record wins: a `location.reload()` can leave several,
    // and the final one is the document Lighthouse actually rendered.
    const matching = documents.filter(
      (record) => record.url === mainDocumentUrl,
    );
    if (matching.length > 0) {
      return matching[matching.length - 1] ?? null;
    }
  }
  return documents[0] ?? records[0] ?? null;
}

/**
 * Builds the {@link HeaderBag} the header checks expect from a network record's
 * `responseHeaders` (an array of `{ name, value }`). Repeated headers are kept
 * as an array under their lower-cased name, so a header "sent twice" is
 * distinguishable from one "sent once with a comma", which the HSTS and CSP
 * analysers rely on.
 *
 * Source artifact: `NetworkRequest.responseHeaders` of the main document.
 */
export function headerBagFromRecord(record: NetworkRequest): HeaderBag {
  const bag: HeaderBag = {};
  for (const { name, value } of record.responseHeaders ?? []) {
    const key = name.toLowerCase();
    const existing = bag[key];
    if (existing === undefined) {
      bag[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      bag[key] = [existing, value];
    }
  }
  return bag;
}

/**
 * Wraps the `MetaElements` artifact in the tiny {@link MetaDocument} the Open
 * Graph reader walks. The reader only ever calls `querySelectorAll('meta')` and
 * then reads the `property`, `name` and `content` attributes, so the shim
 * returns one element per artifact entry and maps those attribute names onto
 * the parsed fields.
 *
 * Source artifact: `MetaElements`. Local to this module: it backs
 * {@link metaHttpEquivContents}.
 */
function metaDocument(
  metaElements: readonly MetaElementArtifact[],
): MetaDocument {
  const elements = metaElements.map((meta) => ({
    getAttribute(attribute: string): string | null {
      switch (attribute.toLowerCase()) {
        case 'property':
          return meta.property ?? null;
        case 'name':
          return meta.name ?? null;
        case 'content':
          return meta.content ?? null;
        case 'http-equiv':
          return meta.httpEquiv ?? null;
        default:
          return null;
      }
    },
  }));
  return {
    // The reader always passes 'meta'; every artifact entry already is a meta.
    querySelectorAll: () => elements,
  };
}

/**
 * Returns the `content` of every `<meta http-equiv="{name}">` from the
 * `MetaElements` artifact, reading them exactly as the webhint hints do (via
 * the library's `metaContents`). Used by the cross-origin audits, whose
 * analyser also accepts a policy declared in a `<meta http-equiv>`.
 *
 * Source artifact: `MetaElements`.
 */
export function metaHttpEquivContents(
  metaElements: readonly MetaElementArtifact[],
  name: string,
): string[] {
  return metaContents(metaDocument(metaElements), 'http-equiv', name);
}

/**
 * Returns the `content` of every `<meta http-equiv="Content-Security-Policy">`
 * from the `MetaElements` artifact, which `analyzeCspFromHeaders` takes as its
 * `metas` argument (a CSP can be delivered in a meta tag as well as a header).
 *
 * Source artifact: `MetaElements`.
 */
export function cspMetaContents(
  metaElements: readonly MetaElementArtifact[],
): string[] {
  return metaElements
    .filter(
      (meta) =>
        (meta.httpEquiv ?? '').trim().toLowerCase() ===
          'content-security-policy' && (meta.content ?? '').trim() !== '',
    )
    .map((meta) => (meta.content ?? '').trim());
}

/**
 * Collects the referrer-policy sources the `effectiveReferrerPolicy` helper
 * needs: `<meta name="referrer">`, `<meta http-equiv="Referrer-Policy">` and
 * the `Referrer-Policy` response header values.
 *
 * Source artifacts: `MetaElements` and the main document's response headers.
 */
export function referrerSources(
  metaElements: readonly MetaElementArtifact[],
  headerValues: string[],
): { metaName: string[]; metaHttpEquiv: string[]; header: string[] } {
  const contentWhere = (predicate: (m: MetaElementArtifact) => boolean) =>
    metaElements
      .filter((meta) => predicate(meta) && (meta.content ?? '').trim() !== '')
      .map((meta) => (meta.content ?? '').trim());
  return {
    metaName: contentWhere(
      (meta) => (meta.name ?? '').trim().toLowerCase() === 'referrer',
    ),
    metaHttpEquiv: contentWhere(
      (meta) =>
        (meta.httpEquiv ?? '').trim().toLowerCase() === 'referrer-policy',
    ),
    header: headerValues,
  };
}
