/**
 * Single-source validators for the `richresults` rules. Each function takes the
 * parsed JSON-LD blocks that `src/lib/geo/json-ld.ts`'s `readJsonLd` already
 * produced ({@link JsonLdBlocks}) and returns the findings for one schema.org
 * type, validated against Google's rich-results requirements for that type.
 *
 * Both surfaces call these: the webhint hints in `src/hints/richresults/*`
 * (which additionally pick the DOM element each finding points at) and the
 * Lighthouse checks in `lighthouse/src/checks/richresults.ts`. The wording and
 * severity of every rule therefore live in exactly one place and the two
 * surfaces cannot drift.
 *
 * Presence is optional, validity is the point: when a page has no node of a
 * type, that type's function returns no findings. When a node is present, its
 * Google-required properties are validated (a missing one is an `error`) and
 * its recommended properties are checked (a missing one is a `warning`). Google
 * documents what is required per type; each function links the matching page.
 */
import type { JsonLdBlocks } from '../geo/json-ld.js';
import { finding, type Finding } from '../headers/finding.js';
import {
  asObject,
  findNodesOfType,
  firstObject,
  hasValue,
  nodeHasAnyType,
  typeLabel,
} from './nodes.js';

/** Base of every Google rich-results documentation page. */
const BASE =
  'https://developers.google.com/search/docs/appearance/structured-data';

/** The documentation page each type's rule is validated against. */
export const DOCS = {
  recipe: `${BASE}/recipe`,
  product: `${BASE}/product-snippet`,
  article: `${BASE}/article`,
  breadcrumb: `${BASE}/breadcrumb`,
  event: `${BASE}/event`,
  video: `${BASE}/video`,
  jobposting: `${BASE}/job-posting`,
  localbusiness: `${BASE}/local-business`,
  review: `${BASE}/review-snippet`,
  searchaction: `${BASE}/sitelinks-searchbox`,
} as const;

/** Every parsed node of a type across all of a page's JSON-LD blocks. */
function nodesOfType(
  blocks: JsonLdBlocks,
  types: readonly string[],
): Record<string, unknown>[] {
  return blocks.parsed.flatMap((data) => findNodesOfType(data, types));
}

/** An error finding for a missing required property. */
function missingRequired(
  label: string,
  property: string,
  doc: string,
): Finding {
  return finding(
    'error',
    `The ${label} structured data is missing the required property "${property}". Add "${property}" so this item is eligible for a rich result. Read more: ${doc}`,
  );
}

/** A warning finding for a missing recommended property. */
function missingRecommended(
  label: string,
  property: string,
  doc: string,
): Finding {
  return finding(
    'warning',
    `The ${label} structured data is missing the recommended property "${property}". Add "${property}" to improve the rich result. Read more: ${doc}`,
  );
}

/**
 * Validates a flat list of required and recommended properties on every node of
 * a type. Shared by the types whose rule is just "these fields must be present"
 * (Recipe, Event, VideoObject, LocalBusiness and the simple part of others).
 */
function validateFlat(
  blocks: JsonLdBlocks,
  types: readonly string[],
  fallbackLabel: string,
  required: readonly string[],
  recommended: readonly string[],
  doc: string,
): Finding[] {
  const findings: Finding[] = [];
  for (const node of nodesOfType(blocks, types)) {
    const label = typeLabel(node, fallbackLabel);
    for (const property of required) {
      if (!hasValue(node, property)) {
        findings.push(missingRequired(label, property, doc));
      }
    }
    for (const property of recommended) {
      if (!hasValue(node, property)) {
        findings.push(missingRecommended(label, property, doc));
      }
    }
  }
  return findings;
}

/**
 * Recipe: Google requires `name` and `image`. `recipeIngredient` and
 * `recipeInstructions` are recommended (an ingredient list and steps are what
 * make the recipe rich result useful). Doc: {@link DOCS.recipe}.
 */
export function recipeFindings(blocks: JsonLdBlocks): Finding[] {
  return validateFlat(
    blocks,
    ['Recipe'],
    'Recipe',
    ['name', 'image'],
    ['recipeIngredient', 'recipeInstructions'],
    DOCS.recipe,
  );
}

/**
 * Event: Google requires `name`, `startDate` and `location`. `endDate` and
 * `offers` are recommended. Doc: {@link DOCS.event}.
 */
export function eventFindings(blocks: JsonLdBlocks): Finding[] {
  return validateFlat(
    blocks,
    ['Event'],
    'Event',
    ['name', 'startDate', 'location'],
    ['endDate'],
    DOCS.event,
  );
}

/**
 * VideoObject: Google requires `name`, `thumbnailUrl` and `uploadDate`.
 * `description` and `contentUrl` are recommended. Doc: {@link DOCS.video}.
 */
export function videoFindings(blocks: JsonLdBlocks): Finding[] {
  return validateFlat(
    blocks,
    ['VideoObject'],
    'VideoObject',
    ['name', 'thumbnailUrl', 'uploadDate'],
    ['description'],
    DOCS.video,
  );
}

/**
 * LocalBusiness (and its subtypes, matched by the base `LocalBusiness` type):
 * Google requires `name` and `address`. `openingHours`, `telephone`,
 * `priceRange` and `geo` are recommended. Doc: {@link DOCS.localbusiness}.
 */
export function localBusinessFindings(blocks: JsonLdBlocks): Finding[] {
  return validateFlat(
    blocks,
    ['LocalBusiness'],
    'LocalBusiness',
    ['name', 'address'],
    ['openingHours', 'telephone'],
    DOCS.localbusiness,
  );
}

/**
 * Article / NewsArticle / BlogPosting: Google documents no strictly required
 * property for Article, but strongly recommends `headline`, `image`,
 * `datePublished` and `author`, so a missing one is a warning, never an error.
 * Doc: {@link DOCS.article}.
 */
export function articleFindings(blocks: JsonLdBlocks): Finding[] {
  return validateFlat(
    blocks,
    ['Article', 'NewsArticle', 'BlogPosting'],
    'Article',
    [],
    ['headline', 'image', 'datePublished', 'author'],
    DOCS.article,
  );
}

/**
 * Product: Google requires `name`. `image` is recommended. When an `offers`,
 * `review` or `aggregateRating` property is present it must itself be valid:
 * an Offer needs `price` and `priceCurrency`; an AggregateOffer needs
 * `lowPrice` and `priceCurrency`; an AggregateRating needs `ratingValue`; a
 * Review needs a `reviewRating` with a `ratingValue`. A product with none of
 * the three gets a recommendation to add one. Doc: {@link DOCS.product}.
 */
export function productFindings(blocks: JsonLdBlocks): Finding[] {
  const findings: Finding[] = [];
  const doc = DOCS.product;
  for (const node of nodesOfType(blocks, ['Product'])) {
    const label = typeLabel(node, 'Product');
    if (!hasValue(node, 'name')) {
      findings.push(missingRequired(label, 'name', doc));
    }
    if (!hasValue(node, 'image')) {
      findings.push(missingRecommended(label, 'image', doc));
    }

    const hasOffers = hasValue(node, 'offers');
    const hasReview = hasValue(node, 'review');
    const hasAggregate = hasValue(node, 'aggregateRating');
    if (!hasOffers && !hasReview && !hasAggregate) {
      findings.push(
        finding(
          'warning',
          `The ${label} structured data has no "offers", "review" or "aggregateRating". Add at least one so the product is eligible for a rich result. Read more: ${doc}`,
        ),
      );
    }

    if (hasOffers) {
      const offer = firstObject(node, 'offers');
      if (offer) {
        if (nodeHasAnyType(offer, ['AggregateOffer'])) {
          if (!hasValue(offer, 'lowPrice')) {
            findings.push(
              missingRequired(`${label} AggregateOffer`, 'lowPrice', doc),
            );
          }
          if (!hasValue(offer, 'priceCurrency')) {
            findings.push(
              missingRequired(`${label} AggregateOffer`, 'priceCurrency', doc),
            );
          }
        } else {
          if (!hasValue(offer, 'price')) {
            findings.push(missingRequired(`${label} Offer`, 'price', doc));
          }
          if (!hasValue(offer, 'priceCurrency')) {
            findings.push(
              missingRequired(`${label} Offer`, 'priceCurrency', doc),
            );
          }
        }
      }
    }

    if (hasAggregate) {
      const rating = firstObject(node, 'aggregateRating');
      if (rating && !hasValue(rating, 'ratingValue')) {
        findings.push(
          missingRequired(`${label} AggregateRating`, 'ratingValue', doc),
        );
      }
    }

    if (hasReview) {
      const review = firstObject(node, 'review');
      if (review) {
        const reviewRating = firstObject(review, 'reviewRating');
        if (!reviewRating || !hasValue(reviewRating, 'ratingValue')) {
          findings.push(
            missingRequired(`${label} Review`, 'reviewRating.ratingValue', doc),
          );
        }
      }
    }
  }
  return findings;
}

/**
 * BreadcrumbList: Google requires a non-empty `itemListElement`, and each
 * `ListItem` needs `position`, `name` and `item`. `item` may be omitted on the
 * last element (the current page), so only a missing `item` before the last
 * element is an error. Doc: {@link DOCS.breadcrumb}.
 */
export function breadcrumbFindings(blocks: JsonLdBlocks): Finding[] {
  const findings: Finding[] = [];
  const doc = DOCS.breadcrumb;
  for (const node of nodesOfType(blocks, ['BreadcrumbList'])) {
    const label = typeLabel(node, 'BreadcrumbList');
    const value = node['itemListElement'];
    const items = Array.isArray(value) ? value : asObject(value) ? [value] : [];
    if (items.length === 0) {
      findings.push(missingRequired(label, 'itemListElement', doc));
      continue;
    }
    items.forEach((raw, index) => {
      const item = asObject(raw);
      if (!item) {
        return;
      }
      if (!hasValue(item, 'position')) {
        findings.push(
          finding(
            'error',
            `The ${label} has a listItem without a "position". Number every breadcrumb item with "position". Read more: ${doc}`,
          ),
        );
      }
      if (!hasValue(item, 'name') && !hasValue(item, 'item')) {
        findings.push(
          finding(
            'error',
            `The ${label} has a listItem without a "name" or "item". Each breadcrumb needs a name (or an item carrying one). Read more: ${doc}`,
          ),
        );
      }
      // `item` is required for every element except the last (the current page).
      const isLast = index === items.length - 1;
      if (!isLast && !hasValue(item, 'item') && !hasValue(item, 'name')) {
        findings.push(
          finding(
            'error',
            `The ${label} has a non-final listItem without an "item" URL. Link every breadcrumb but the last with "item". Read more: ${doc}`,
          ),
        );
      }
    });
  }
  return findings;
}

/**
 * JobPosting: Google requires `title`, `description`, `datePosted`,
 * `hiringOrganization` and `jobLocation`. `jobLocation` may be omitted only for
 * a fully remote role, which is declared with `jobLocationType` TELECOMMUTE (and
 * `applicantLocationRequirements`); when that is present a missing `jobLocation`
 * is not reported. `validThrough` and `baseSalary` are recommended. Doc:
 * {@link DOCS.jobposting}.
 */
export function jobPostingFindings(blocks: JsonLdBlocks): Finding[] {
  const findings: Finding[] = [];
  const doc = DOCS.jobposting;
  for (const node of nodesOfType(blocks, ['JobPosting'])) {
    const label = typeLabel(node, 'JobPosting');
    for (const property of [
      'title',
      'description',
      'datePosted',
      'hiringOrganization',
    ]) {
      if (!hasValue(node, property)) {
        findings.push(missingRequired(label, property, doc));
      }
    }
    const remote =
      typeof node['jobLocationType'] === 'string' &&
      node['jobLocationType'].toUpperCase() === 'TELECOMMUTE';
    if (!remote && !hasValue(node, 'jobLocation')) {
      findings.push(missingRequired(label, 'jobLocation', doc));
    }
    for (const property of ['validThrough', 'baseSalary']) {
      if (!hasValue(node, property)) {
        findings.push(missingRecommended(label, property, doc));
      }
    }
  }
  return findings;
}

/**
 * Review / AggregateRating: a review snippet needs the thing it is about and a
 * rating. A `Review` requires `itemReviewed` and a `reviewRating` carrying a
 * `ratingValue`; an `AggregateRating` requires `ratingValue` and one of
 * `ratingCount`/`reviewCount`. Doc: {@link DOCS.review}.
 */
export function reviewFindings(blocks: JsonLdBlocks): Finding[] {
  const findings: Finding[] = [];
  const doc = DOCS.review;
  for (const node of nodesOfType(blocks, ['Review'])) {
    const label = typeLabel(node, 'Review');
    if (!hasValue(node, 'itemReviewed')) {
      findings.push(missingRequired(label, 'itemReviewed', doc));
    }
    const reviewRating = firstObject(node, 'reviewRating');
    if (!reviewRating || !hasValue(reviewRating, 'ratingValue')) {
      findings.push(missingRequired(label, 'reviewRating.ratingValue', doc));
    }
  }
  for (const node of nodesOfType(blocks, ['AggregateRating'])) {
    const label = typeLabel(node, 'AggregateRating');
    if (!hasValue(node, 'ratingValue')) {
      findings.push(missingRequired(label, 'ratingValue', doc));
    }
    if (!hasValue(node, 'ratingCount') && !hasValue(node, 'reviewCount')) {
      findings.push(
        finding(
          'error',
          `The ${label} structured data is missing a "ratingCount" or "reviewCount". Add one so the rating is eligible for a rich result. Read more: ${doc}`,
        ),
      );
    }
  }
  return findings;
}

/**
 * WebSite with a SearchAction (the sitelinks search box): the WebSite node's
 * `potentialAction` must be a SearchAction carrying a `target` and a
 * `query-input`. A WebSite with no SearchAction at all reports nothing (the
 * search box is optional); one with a malformed SearchAction is an error. Doc:
 * {@link DOCS.searchaction}.
 */
export function websiteSearchActionFindings(blocks: JsonLdBlocks): Finding[] {
  const findings: Finding[] = [];
  const doc = DOCS.searchaction;
  for (const node of nodesOfType(blocks, ['WebSite'])) {
    const label = typeLabel(node, 'WebSite');
    const raw = node['potentialAction'];
    const actions = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    const search = actions
      .map((action) => asObject(action))
      .find((action) => action && nodeHasAnyType(action, ['SearchAction']));
    if (!search) {
      // No SearchAction present: the sitelinks search box is optional.
      continue;
    }
    if (!hasValue(search, 'target')) {
      findings.push(missingRequired(`${label} SearchAction`, 'target', doc));
    }
    // The property is spelled `query-input` in schema.org's action syntax.
    if (!hasValue(search, 'query-input')) {
      findings.push(
        missingRequired(`${label} SearchAction`, 'query-input', doc),
      );
    }
  }
  return findings;
}
