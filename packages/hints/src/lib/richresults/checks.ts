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
import { finding } from '../headers/finding.js';
import {
  asObject,
  findNodesOfType,
  firstObject,
  hasValue,
  nodeHasAnyType,
  typeLabel,
} from './nodes.js';
import type { Finding } from '../headers/finding.js';
import type { JsonLdBlocks } from '../geo/json-ld.js';

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
  parsedDocument: string,
): Finding {
  return finding(
    'error',
    `The ${label} structured data is missing the required property "${property}". Add "${property}" so this item is eligible for a rich result. Read more: ${parsedDocument}`,
  );
}

/** A warning finding for a missing recommended property. */
function missingRecommended(
  label: string,
  property: string,
  parsedDocument: string,
): Finding {
  return finding(
    'warning',
    `The ${label} structured data is missing the recommended property "${property}". Add "${property}" to improve the rich result. Read more: ${parsedDocument}`,
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
  parsedDocument: string,
): Finding[] {
  return nodesOfType(blocks, types).flatMap((node) => {
    const label = typeLabel(node, fallbackLabel);
    return [
      ...required.flatMap((property) =>
        hasValue(node, property)
          ? []
          : [missingRequired(label, property, parsedDocument)],
      ),
      ...recommended.flatMap((property) =>
        hasValue(node, property)
          ? []
          : [missingRecommended(label, property, parsedDocument)],
      ),
    ];
  });
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

/** The AggregateOffer and Offer branches mirror the schema.org shapes. */
function offerFindings(
  label: string,
  offer: Record<string, unknown>,
  parsedDocument: string,
): Finding[] {
  const kind = nodeHasAnyType(offer, ['AggregateOffer'])
    ? `${label} AggregateOffer`
    : `${label} Offer`;
  const required = nodeHasAnyType(offer, ['AggregateOffer'])
    ? ['lowPrice', 'priceCurrency']
    : ['price', 'priceCurrency'];
  return required
    .filter((property) => !hasValue(offer, property))
    .map((property) => missingRequired(kind, property, parsedDocument));
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
  const parsedDocument = DOCS.product;
  return nodesOfType(blocks, ['Product']).flatMap((node) => {
    const label = typeLabel(node, 'Product');
    const hasOffers = hasValue(node, 'offers');
    const hasReview = hasValue(node, 'review');
    const hasAggregate = hasValue(node, 'aggregateRating');
    const offer = hasOffers ? firstObject(node, 'offers') : null;
    const rating = hasAggregate ? firstObject(node, 'aggregateRating') : null;
    const review = hasReview ? firstObject(node, 'review') : null;
    const reviewRating = review ? firstObject(review, 'reviewRating') : null;
    return [
      ...(hasValue(node, 'name')
        ? []
        : [missingRequired(label, 'name', parsedDocument)]),
      ...(hasValue(node, 'image')
        ? []
        : [missingRecommended(label, 'image', parsedDocument)]),
      ...(!hasOffers && !hasReview && !hasAggregate
        ? [
            finding(
              'warning',
              `The ${label} structured data has no "offers", "review" or "aggregateRating". Add at least one so the product is eligible for a rich result. Read more: ${parsedDocument}`,
            ),
          ]
        : []),
      ...(offer ? offerFindings(label, offer, parsedDocument) : []),
      ...(rating && !hasValue(rating, 'ratingValue')
        ? [
            missingRequired(
              `${label} AggregateRating`,
              'ratingValue',
              parsedDocument,
            ),
          ]
        : []),
      ...(review && (!reviewRating || !hasValue(reviewRating, 'ratingValue'))
        ? [
            missingRequired(
              `${label} Review`,
              'reviewRating.ratingValue',
              parsedDocument,
            ),
          ]
        : []),
    ];
  });
}

/**
 * BreadcrumbList: Google requires a non-empty `itemListElement`, and each
 * `ListItem` needs `position`, `name` and `item`. `item` may be omitted on the
 * last element (the current page), so only a missing `item` before the last
 * element is an error. Doc: {@link DOCS.breadcrumb}.
 */
export function breadcrumbFindings(blocks: JsonLdBlocks): Finding[] {
  const parsedDocument = DOCS.breadcrumb;
  return nodesOfType(blocks, ['BreadcrumbList']).flatMap((node) => {
    const label = typeLabel(node, 'BreadcrumbList');
    const value = node.itemListElement;
    const items = Array.isArray(value)
      ? value
      : [value].filter((entry) => asObject(entry) !== null);
    if (items.length === 0) {
      return [missingRequired(label, 'itemListElement', parsedDocument)];
    }
    return [...items.entries()].flatMap(([index, raw]) => {
      const item = asObject(raw);
      if (!item) {
        return [];
      }
      // `item` is required for every element except the last (the current page).
      const isLast = index === items.length - 1;
      return [
        ...(hasValue(item, 'position')
          ? []
          : [
              finding(
                'error',
                `The ${label} has a listItem without a "position". Number every breadcrumb item with "position". Read more: ${parsedDocument}`,
              ),
            ]),
        ...(!hasValue(item, 'name') && !hasValue(item, 'item')
          ? [
              finding(
                'error',
                `The ${label} has a listItem without a "name" or "item". Each breadcrumb needs a name (or an item carrying one). Read more: ${parsedDocument}`,
              ),
            ]
          : []),
        ...(!isLast && !hasValue(item, 'item') && !hasValue(item, 'name')
          ? [
              finding(
                'error',
                `The ${label} has a non-final listItem without an "item" URL. Link every breadcrumb but the last with "item". Read more: ${parsedDocument}`,
              ),
            ]
          : []),
      ];
    });
  });
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
  const parsedDocument = DOCS.jobposting;
  return nodesOfType(blocks, ['JobPosting']).flatMap((node) => {
    const label = typeLabel(node, 'JobPosting');
    const remote =
      typeof node.jobLocationType === 'string' &&
      node.jobLocationType.toUpperCase() === 'TELECOMMUTE';
    return [
      ...['title', 'description', 'datePosted', 'hiringOrganization'].flatMap(
        (property) =>
          hasValue(node, property)
            ? []
            : [missingRequired(label, property, parsedDocument)],
      ),
      ...(!remote && !hasValue(node, 'jobLocation')
        ? [missingRequired(label, 'jobLocation', parsedDocument)]
        : []),
      ...['validThrough', 'baseSalary'].flatMap((property) =>
        hasValue(node, property)
          ? []
          : [missingRecommended(label, property, parsedDocument)],
      ),
    ];
  });
}

/**
 * Review / AggregateRating: a review snippet needs the thing it is about and a
 * rating. A `Review` requires `itemReviewed` and a `reviewRating` carrying a
 * `ratingValue`; an `AggregateRating` requires `ratingValue` and one of
 * `ratingCount`/`reviewCount`. Doc: {@link DOCS.review}.
 */
export function reviewFindings(blocks: JsonLdBlocks): Finding[] {
  const parsedDocument = DOCS.review;
  return [
    ...nodesOfType(blocks, ['Review']).flatMap((node) => {
      const label = typeLabel(node, 'Review');
      const reviewRating = firstObject(node, 'reviewRating');
      return [
        ...(hasValue(node, 'itemReviewed')
          ? []
          : [missingRequired(label, 'itemReviewed', parsedDocument)]),
        ...(!reviewRating || !hasValue(reviewRating, 'ratingValue')
          ? [missingRequired(label, 'reviewRating.ratingValue', parsedDocument)]
          : []),
      ];
    }),
    ...nodesOfType(blocks, ['AggregateRating']).flatMap((node) => {
      const label = typeLabel(node, 'AggregateRating');
      return [
        ...(hasValue(node, 'ratingValue')
          ? []
          : [missingRequired(label, 'ratingValue', parsedDocument)]),
        ...(!hasValue(node, 'ratingCount') && !hasValue(node, 'reviewCount')
          ? [
              finding(
                'error',
                `The ${label} structured data is missing a "ratingCount" or "reviewCount". Add one so the rating is eligible for a rich result. Read more: ${parsedDocument}`,
              ),
            ]
          : []),
      ];
    }),
  ];
}

/**
 * WebSite with a SearchAction (the sitelinks search box): the WebSite node's
 * `potentialAction` must be a SearchAction carrying a `target` and a
 * `query-input`. A WebSite with no SearchAction at all reports nothing (the
 * search box is optional); one with a malformed SearchAction is an error. Doc:
 * {@link DOCS.searchaction}.
 */
export function websiteSearchActionFindings(blocks: JsonLdBlocks): Finding[] {
  const parsedDocument = DOCS.searchaction;
  return nodesOfType(blocks, ['WebSite']).flatMap((node) => {
    const label = typeLabel(node, 'WebSite');
    const raw = node.potentialAction;
    const actions = Array.isArray(raw)
      ? raw
      : [raw].filter((entry) => entry !== undefined);
    const search = actions
      .map((action) => asObject(action))
      .find((action) => action && nodeHasAnyType(action, ['SearchAction']));
    if (!search) {
      // No SearchAction present: the sitelinks search box is optional.
      return [];
    }
    return [
      ...(hasValue(search, 'target')
        ? []
        : [missingRequired(`${label} SearchAction`, 'target', parsedDocument)]),
      // The property is spelled `query-input` in schema.org's action syntax.
      ...(hasValue(search, 'query-input')
        ? []
        : [
            missingRequired(
              `${label} SearchAction`,
              'query-input',
              parsedDocument,
            ),
          ]),
    ];
  });
}
