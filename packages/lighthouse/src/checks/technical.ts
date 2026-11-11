/**
 * The `technical` check set: the LLMScout-derived technical SEO hints that a
 * Lighthouse *plugin* can run from the artifacts Lighthouse already gathers.
 * Each check reshapes an artifact into the small structural input the shared
 * `src/lib/technical/read.ts` function takes (through the adapters in
 * `../adapt-technical.ts`) and calls that exact function, so a page yields the
 * same findings here as under the webhint hint.
 *
 * Seven hints are covered: technical-heading-hierarchy,
 * technical-image-alt-coverage, technical-robots-meta-advanced,
 * technical-twitter-card-type, technical-canonical-invalid,
 * technical-redirect-chain and technical-image-weight.
 *
 * Where the data lives:
 *   - heading order and `<img alt>` presence have no parsed artifact, so they
 *     are read from `MainDocumentContent` (the served HTML).
 *   - the robots and Twitter-card meta tags come from `MetaElements`, the
 *     canonical link from `LinkElements`, the image sources from
 *     `ImageElements`, and image transfer sizes and the main document's
 *     redirect chain from `NetworkRecords` (the devtools log).
 *
 * Titles, descriptions, references and sections come from the compiled hint
 * metadata (`../meta.ts`), so they are never restated here. Every check is
 * graded (`numeric`): the reproducible ones are all gradable from the homepage
 * Lighthouse loads, so none is informative.
 */
import { NetworkRecords } from 'lighthouse';
import type { Artifacts } from 'lighthouse';
import type { HintDefinition } from '@mridang/webhint-hint-plumbline/dist/core/define-hint.js';
import { finding } from '@mridang/webhint-hint-plumbline/dist/lib/headers/finding.js';
import {
  altCoverage,
  canonicalHref,
  firstSkippedLevel,
  headingLevels,
  imageUrls,
  redirectVerdict,
  robotsAdvanced,
  twitterCardType,
} from '@mridang/webhint-hint-plumbline/dist/lib/technical/read.js';
// The predicate-and-message functions shared with the webhint hints. Both
// surfaces call these, so a rule's wording lives in exactly one place.
import {
  canonicalInvalidFindings,
  headingHierarchyFindings,
  imageAltCoverageFindings,
  imageWeightFinding,
  robotsMetaAdvancedFindings,
  twitterCardTypeFindings,
} from '@mridang/webhint-hint-plumbline/dist/lib/technical/checks.js';
import { findMainDocument } from '../adapt.js';
import {
  htmlDocument,
  imageSizesByUrl,
  imageSourceDocument,
  linkDocument,
  metaDocument,
  redirectHops,
} from '../adapt-technical.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';

// The compiled webhint hints, imported only for their metadata (name,
// description, reference, section); their check logic is reused through the
// `src/lib/technical/read.ts` functions above, not through these modules.
import canonicalInvalidHint from '@mridang/webhint-hint-plumbline/dist/hints/technical/technical-canonical-invalid.js';
import headingHierarchyHint from '@mridang/webhint-hint-plumbline/dist/hints/technical/technical-heading-hierarchy.js';
import imageAltCoverageHint from '@mridang/webhint-hint-plumbline/dist/hints/technical/technical-image-alt-coverage.js';
import imageWeightHint from '@mridang/webhint-hint-plumbline/dist/hints/technical/technical-image-weight.js';
import redirectChainHint from '@mridang/webhint-hint-plumbline/dist/hints/technical/technical-redirect-chain.js';
import robotsMetaAdvancedHint from '@mridang/webhint-hint-plumbline/dist/hints/technical/technical-robots-meta-advanced.js';
import twitterCardTypeHint from '@mridang/webhint-hint-plumbline/dist/hints/technical/technical-twitter-card-type.js';

/**
 * Builds a check that borrows its metadata from a compiled webhint hint. The
 * title, description, reference and section are taken from the hint, so they
 * are never restated here. (Local to the set, mirroring `headers.ts`.).
 */
function fromHint(
  definition: HintDefinition,
  config: Pick<AuditCheck, 'scoreMode' | 'run'> & {
    requiredArtifacts: readonly string[];
  },
): AuditCheck {
  const docs = hintDocs(definition);
  return {
    id: definition.id,
    // Every technical hint is placed in the taxonomy; fall back to the seo
    // section defensively rather than emit an empty group.
    section: docs.section ?? 'seo',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode: config.scoreMode,
    requiredArtifacts: config.requiredArtifacts,
    run: config.run,
  };
}

/** The page URL the relative-URL and image checks resolve against. */
function pageUrl(artifacts: Artifacts): string {
  return (
    artifacts.URL?.finalDisplayedUrl || artifacts.URL?.mainDocumentUrl || ''
  );
}

/** The seven technical checks, in report order. */
export const technicalChecks: readonly AuditCheck[] = [
  // Heading order comes from the served HTML; a jump of more than one level is
  // advice (warning), matching LLMScout's heading-structure check.
  fromHint(headingHierarchyHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ['MainDocumentContent', 'URL'],
    run: (artifacts) => {
      const html = artifacts.MainDocumentContent;
      if (!html) {
        return null;
      }
      const doc = htmlDocument(html, pageUrl(artifacts));
      return headingHierarchyFindings(firstSkippedLevel(headingLevels(doc)));
    },
  }),

  // `<img alt>` coverage is read from the served HTML (ImageElements carries no
  // alt). Below 80% coverage is an error, at or above it is advice.
  fromHint(imageAltCoverageHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ['MainDocumentContent', 'URL'],
    run: (artifacts) => {
      const html = artifacts.MainDocumentContent;
      if (!html) {
        return null;
      }
      const doc = htmlDocument(html, pageUrl(artifacts));
      return imageAltCoverageFindings(altCoverage(doc));
    },
  }),

  // The robots meta tag's advanced snippet/preview directives, from
  // MetaElements. A noindex page is skipped (seo-robots-noindex covers it).
  fromHint(robotsMetaAdvancedHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ['MetaElements'],
    run: (artifacts) =>
      robotsMetaAdvancedFindings(
        robotsAdvanced(metaDocument(artifacts.MetaElements)),
      ),
  }),

  // The twitter:card value, from MetaElements. An unrecognised type is an
  // error; this check lands in the sharing section per the taxonomy.
  fromHint(twitterCardTypeHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ['MetaElements'],
    run: (artifacts) =>
      twitterCardTypeFindings(
        twitterCardType(metaDocument(artifacts.MetaElements)),
      ),
  }),

  // The canonical link's href, from LinkElements, judged against the page URL.
  // An href that does not resolve to a URL is an error.
  fromHint(canonicalInvalidHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ['LinkElements', 'URL'],
    run: (artifacts) =>
      canonicalInvalidFindings(
        canonicalHref(linkDocument(artifacts.LinkElements)),
        pageUrl(artifacts),
      ),
  }),

  // The main document's redirect chain, from the network records: a chain that
  // ends in an error status is an error, more than two hops is advice.
  fromHint(redirectChainHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ['DevtoolsLog', 'URL'],
    run: async (artifacts, context) => {
      const records = await NetworkRecords.request(
        artifacts.DevtoolsLog,
        context,
      );
      const mainDocumentUrl =
        artifacts.URL.mainDocumentUrl || artifacts.URL.finalDisplayedUrl;
      const main = findMainDocument(records, mainDocumentUrl);
      if (!main) {
        return null;
      }
      const verdict = redirectVerdict(
        redirectHops(main),
        main.url,
        main.statusCode,
      );
      return verdict ? [finding(verdict.severity, verdict.message)] : [];
    },
  }),

  // Image weight: the image sources from ImageElements, their transfer sizes
  // from the network records. Over 500 KB is an error, over 200 KB is advice.
  fromHint(imageWeightHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ['ImageElements', 'DevtoolsLog', 'URL'],
    run: async (artifacts, context) => {
      const records = await NetworkRecords.request(
        artifacts.DevtoolsLog,
        context,
      );
      const urls = imageUrls(
        imageSourceDocument(artifacts.ImageElements),
        pageUrl(artifacts),
      );
      const sizes = imageSizesByUrl(records);
      const findings = [];
      for (const url of urls) {
        const bytes = sizes.get(url);
        if (bytes === undefined) {
          // An image with no measurable response is not reported, matching the
          // webhint hint's treatment of an unreachable image.
          continue;
        }
        // The shared check turns a measured size into its finding (or null when
        // the image is light enough), so the wording matches the webhint hint.
        const found = imageWeightFinding(url, bytes);
        if (found !== null) {
          findings.push(found);
        }
      }
      return findings;
    },
  }),
];
