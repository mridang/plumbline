/**
 * The `feeds` check set: the DOM-only discovery hints of the webhint `feeds`
 * set, run from the artifacts Lighthouse already gathers. Only the three
 * discovery checks are plugin-able — `feed-discovery`, `oembed-discovery` and
 * `opensearch-discovery` — because each reads nothing but the page's own
 * `<link>` elements. The two webhint `*-valid` hints fetch the linked feed or
 * OpenSearch document after the scan, which a Lighthouse plugin cannot do, so
 * they have no check here.
 *
 * Each check parses the raw `MainDocumentContent` into the same DOM webhint
 * uses (`@hint/utils-dom`'s `createHTMLDocument`) and calls the *same
 * single-source rule function* the webhint hint calls
 * (`src/lib/feeds/checks.ts`), so the predicate, message and severity live in
 * one place and cannot drift. The `<link>` attributes the readers need
 * (`rel`, `type`, `href`) are not exposed completely by Lighthouse's parsed
 * `LinkElements` artifact (which omits `type`), so the raw HTML is the only
 * reliable source and is parsed directly.
 *
 * Scoring. Discovery is informative: a page is not wrong for having no feed,
 * oEmbed or OpenSearch link, so these checks are `informative` and surface the
 * finding without affecting the score. The numeric gate for an *invalid linked
 * document* belongs to the webhint-only `*-valid` hints, not here.
 */
import { createRequire } from 'node:module';
import type * as LH from 'lighthouse';
import type { HTMLDocument } from '@hint/utils-dom';
import type { HintDefinition } from '@mridang/webhint-hint-extra/dist/core/define-hint.js';
import type { DocumentLike } from '@mridang/webhint-hint-extra/dist/lib/feeds/read.js';
import {
  feedDiscovery,
  oembedDiscovery,
  opensearchDiscovery,
} from '@mridang/webhint-hint-extra/dist/lib/feeds/checks.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';

// The compiled webhint hints, imported only for their metadata (name,
// description, reference, section); their check logic is reused through the
// `src/lib/feeds/**` rule functions above, not through these modules.
import feedDiscoveryHint from '@mridang/webhint-hint-extra/dist/hints/feeds/feed-discovery.js';
import oembedDiscoveryHint from '@mridang/webhint-hint-extra/dist/hints/feeds/oembed-discovery.js';
import opensearchDiscoveryHint from '@mridang/webhint-hint-extra/dist/hints/feeds/opensearch-discovery.js';

// `@hint/utils-dom` ships as CommonJS, so it is loaded through `createRequire`
// (the pattern the SEO adapter uses) rather than a named ESM import.
const require = createRequire(import.meta.url);
const { createHTMLDocument } = require('@hint/utils-dom') as {
  createHTMLDocument: (html: string, finalHref: string) => HTMLDocument;
};

/** The only artifacts the discovery checks read. */
const HTML_ONLY = ['MainDocumentContent', 'URL'] as const;

/** The page URL a check resolves relative hrefs against. */
function pageUrl(artifacts: LH.Artifacts): string {
  return (
    artifacts.URL?.finalDisplayedUrl || artifacts.URL?.mainDocumentUrl || ''
  );
}

/** Parses the main document into the {@link DocumentLike} the readers query. */
function documentOf(artifacts: LH.Artifacts): DocumentLike {
  const html = artifacts.MainDocumentContent ?? '';
  return createHTMLDocument(
    html,
    pageUrl(artifacts) || 'http://localhost/',
  ) as unknown as DocumentLike;
}

/**
 * Builds a check that borrows its metadata (title, description, reference,
 * section) from a compiled webhint hint and reuses one `src/lib/feeds` rule.
 */
function fromHint(
  definition: HintDefinition,
  run: AuditCheck['run'],
): AuditCheck {
  const docs = hintDocs(definition);
  return {
    id: definition.id,
    section: docs.section ?? 'social-previews',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode: 'informative',
    requiredArtifacts: HTML_ONLY,
    run,
  };
}

/** The three plugin-able feed-discovery checks. */
export const feedsChecks: readonly AuditCheck[] = [
  fromHint(feedDiscoveryHint, (artifacts) =>
    artifacts.MainDocumentContent !== undefined
      ? feedDiscovery(documentOf(artifacts))
      : null,
  ),
  fromHint(oembedDiscoveryHint, (artifacts) =>
    artifacts.MainDocumentContent !== undefined
      ? oembedDiscovery(documentOf(artifacts))
      : null,
  ),
  fromHint(opensearchDiscoveryHint, (artifacts) =>
    artifacts.MainDocumentContent !== undefined
      ? opensearchDiscovery(documentOf(artifacts))
      : null,
  ),
];
