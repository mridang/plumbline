/**
 * The `opengraph` check set: the webhint Open Graph and Twitter Card hints
 * (from https://www.opengraph.to) that a Lighthouse *plugin* can run from the
 * `MetaElements` artifact Lighthouse already gathers. Each check reshapes that
 * artifact into the Open Graph reader's `meta(key)` lookup (through
 * `../adapt-opengraph.ts`) and calls the SAME shared rule function the webhint
 * hint calls, so a site yields the same results here as under the webhint
 * hints.
 *
 * The rule's predicate, message and severity live once, in
 * `src/lib/opengraph/checks.ts` (exported pure functions returning the library
 * `Finding[]`). The webhint hint (through `src/lib/opengraph/define.ts`) and
 * each check below both call those functions, so the thresholds, text and
 * severity can never drift between the two. Metadata (title, description,
 * reference, section) is still borrowed from the compiled hint via `hintDocs`,
 * so none of it is restated. Scoring is the plugin's own concern and is the one
 * thing decided here, per check.
 *
 * Scoring: a check is graded (`numeric`) when its webhint severity is an error
 * or a warning (a rule a homepage run can hold a page to), and `informative`
 * when the webhint severity is `Severity.hint` (advice the hint surfaces but
 * does not grade): opengraph-title-too-short, opengraph-description-too-short,
 * opengraph-description-slightly-long, opengraph-description-could-be-longer,
 * opengraph-type-missing, opengraph-site-name-missing, opengraph-locale-missing,
 * opengraph-image-alt-missing, twitter-card-not-large and twitter-site-missing.
 *
 * NOT implemented here (gatherer-only): the Open Graph image hints whose rule
 * function reads the downloaded `og:image` file — opengraph-image-broken,
 * opengraph-image-too-large, opengraph-image-too-small,
 * opengraph-image-non-optimal-size and opengraph-image-dimensions-too-large.
 * A plugin runs after gathering and cannot issue that network fetch, so these
 * are left to a custom gatherer. (The three image hints that read only tags —
 * opengraph-image-not-https, opengraph-image-dimensions-missing and
 * opengraph-image-alt-missing — are included.)
 */
import type { HintDefinition } from '@mridang/webhint-hint-plumbline/dist/core/define-hint.js';
import type { Finding } from '@mridang/webhint-hint-plumbline/dist/lib/headers/finding.js';
import {
  ogDescriptionCouldBeLonger,
  ogDescriptionIsUrl,
  ogDescriptionKeywordStuffing,
  ogDescriptionMissing,
  ogDescriptionSameAsTitle,
  ogDescriptionSlightlyLong,
  ogDescriptionTooLong,
  ogDescriptionTooShort,
  ogImageAltMissing,
  ogImageDimensionsMissing,
  ogImageMissing,
  ogImageNotHttps,
  ogLocaleMissing,
  ogSiteNameMissing,
  ogTitleMissing,
  ogTitleTooLong,
  ogTitleTooShort,
  ogTypeMissing,
  ogUrlMissing,
  twitterCardMissing,
  twitterCardNotLarge,
  twitterDescriptionMissing,
  twitterImageMissing,
  twitterSiteMissing,
  twitterTitleMissing,
} from '@mridang/webhint-hint-plumbline/dist/lib/opengraph/checks.js';
import { ogMetaReader } from '../adapt-opengraph.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';

// The compiled webhint hints, imported only for their metadata (name,
// description, reference, section); their rule logic is the shared
// `src/lib/opengraph/checks.ts` function each check calls below.
import ogDescriptionCouldBeLongerHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-description-could-be-longer.js';
import ogDescriptionIsUrlHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-description-is-url.js';
import ogDescriptionKeywordStuffingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-description-keyword-stuffing.js';
import ogDescriptionMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-description-missing.js';
import ogDescriptionSameAsTitleHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-description-same-as-title.js';
import ogDescriptionSlightlyLongHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-description-slightly-long.js';
import ogDescriptionTooLongHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-description-too-long.js';
import ogDescriptionTooShortHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-description-too-short.js';
import ogImageAltMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-image-alt-missing.js';
import ogImageDimensionsMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-image-dimensions-missing.js';
import ogImageMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-image-missing.js';
import ogImageNotHttpsHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-image-not-https.js';
import ogLocaleMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-locale-missing.js';
import ogSiteNameMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-site-name-missing.js';
import ogTitleMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-title-missing.js';
import ogTitleTooLongHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-title-too-long.js';
import ogTitleTooShortHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-title-too-short.js';
import ogTypeMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-type-missing.js';
import ogUrlMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/opengraph-url-missing.js';
import twitterCardMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/twitter-card-missing.js';
import twitterCardNotLargeHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/twitter-card-not-large.js';
import twitterDescriptionMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/twitter-description-missing.js';
import twitterImageMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/twitter-image-missing.js';
import twitterSiteMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/twitter-site-missing.js';
import twitterTitleMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/opengraph/twitter-title-missing.js';

/** The only artifact the Open Graph checks read. */
const META_ARTIFACTS = ['MetaElements'] as const;

/**
 * A shared rule function from `src/lib/opengraph/checks.ts`. Every check in
 * this set reads only the page's meta tags, so it needs just the `meta(key)`
 * reader; the image-fetch rules (which also take the downloaded file) are
 * gatherer-only and not registered here.
 */
type MetaRuleFn = (input: {
  meta: (key: string) => string | null;
}) => readonly Finding[];

/**
 * Builds a check that borrows its metadata from a compiled webhint hint and
 * runs the shared `rule` function against a `meta(key)` reader over the
 * `MetaElements` artifact. The title, description, reference and section come
 * from the hint, so they are never restated, and the message and severity come
 * from the shared rule function, so they are never reproduced. `scoreMode`
 * decides whether the finding is graded or surfaced as information only.
 */
function fromHint(
  definition: HintDefinition,
  scoreMode: AuditCheck['scoreMode'],
  rule: MetaRuleFn,
): AuditCheck {
  const docs = hintDocs(definition);
  return {
    id: definition.id,
    // Every Open Graph/Twitter hint is placed under 'sharing' in the
    // taxonomy; fall back to it defensively rather than emit an empty group.
    section: docs.section ?? 'sharing',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode,
    requiredArtifacts: META_ARTIFACTS,
    run: (artifacts) => {
      // `MetaElements` is always present on a real run, but guard defensively:
      // with no artifact there is nothing to judge, so the audit is N/A.
      const metaElements = artifacts.MetaElements;
      if (!metaElements) {
        return null;
      }
      return rule({ meta: ogMetaReader(metaElements) });
    },
  };
}

/** The 25 Open Graph + Twitter checks, in report order. */
export const opengraphChecks: readonly AuditCheck[] = [
  // --- og:title -----------------------------------------------------------
  fromHint(ogTitleMissingHint, 'numeric', ogTitleMissing),
  fromHint(ogTitleTooLongHint, 'numeric', ogTitleTooLong),
  fromHint(ogTitleTooShortHint, 'informative', ogTitleTooShort),

  // --- og:description -----------------------------------------------------
  fromHint(ogDescriptionMissingHint, 'numeric', ogDescriptionMissing),
  fromHint(ogDescriptionTooLongHint, 'numeric', ogDescriptionTooLong),
  fromHint(
    ogDescriptionSlightlyLongHint,
    'informative',
    ogDescriptionSlightlyLong,
  ),
  fromHint(ogDescriptionTooShortHint, 'informative', ogDescriptionTooShort),
  fromHint(
    ogDescriptionCouldBeLongerHint,
    'informative',
    ogDescriptionCouldBeLonger,
  ),
  fromHint(ogDescriptionIsUrlHint, 'numeric', ogDescriptionIsUrl),
  fromHint(ogDescriptionSameAsTitleHint, 'numeric', ogDescriptionSameAsTitle),
  fromHint(
    ogDescriptionKeywordStuffingHint,
    'numeric',
    ogDescriptionKeywordStuffing,
  ),

  // --- og:url / og:type / og:site_name / og:locale -----------------------
  fromHint(ogUrlMissingHint, 'numeric', ogUrlMissing),
  fromHint(ogTypeMissingHint, 'informative', ogTypeMissing),
  fromHint(ogSiteNameMissingHint, 'informative', ogSiteNameMissing),
  fromHint(ogLocaleMissingHint, 'informative', ogLocaleMissing),

  // --- og:image (tag-only rules; image-fetch rules are gatherer-only) -----
  fromHint(ogImageMissingHint, 'numeric', ogImageMissing),
  fromHint(ogImageNotHttpsHint, 'numeric', ogImageNotHttps),
  fromHint(ogImageDimensionsMissingHint, 'numeric', ogImageDimensionsMissing),
  fromHint(ogImageAltMissingHint, 'informative', ogImageAltMissing),

  // --- twitter:* ----------------------------------------------------------
  fromHint(twitterCardMissingHint, 'numeric', twitterCardMissing),
  fromHint(twitterCardNotLargeHint, 'informative', twitterCardNotLarge),
  fromHint(twitterTitleMissingHint, 'numeric', twitterTitleMissing),
  fromHint(twitterDescriptionMissingHint, 'numeric', twitterDescriptionMissing),
  fromHint(twitterImageMissingHint, 'numeric', twitterImageMissing),
  fromHint(twitterSiteMissingHint, 'informative', twitterSiteMissing),
];
