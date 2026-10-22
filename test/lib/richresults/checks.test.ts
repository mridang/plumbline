import { describe, expect, it } from '@jest/globals';
import type { JsonLdBlocks } from '../../../src/lib/geo/json-ld.js';
import {
  articleFindings,
  breadcrumbFindings,
  eventFindings,
  jobPostingFindings,
  localBusinessFindings,
  productFindings,
  recipeFindings,
  reviewFindings,
  videoFindings,
  websiteSearchActionFindings,
} from '../../../src/lib/richresults/checks.js';

/** Wraps already-parsed JSON-LD values as the blocks a check reads. */
function blocks(...parsed: unknown[]): JsonLdBlocks {
  return {
    total: parsed.length,
    invalid: 0,
    parsed,
    parsedAt: parsed.map((_unused, index) => index),
    invalidAt: [],
  };
}

const severities = (findings: { severity: string }[]): string[] =>
  findings.map((finding) => finding.severity);

describe('recipeFindings', () => {
  it('is silent when no Recipe node is present', () => {
    expect(recipeFindings(blocks({ '@type': 'WebPage' }))).toEqual([]);
  });
  it('errors on missing required name and image', () => {
    const findings = recipeFindings(blocks({ '@type': 'Recipe' }));
    expect(severities(findings)).toEqual([
      'error',
      'error',
      'warning',
      'warning',
    ]);
    expect(findings[0].message).toContain('"name"');
  });
  it('warns only on missing recommended fields', () => {
    const findings = recipeFindings(
      blocks({ '@type': 'Recipe', name: 'Pie', image: 'p.jpg' }),
    );
    expect(severities(findings)).toEqual(['warning', 'warning']);
  });
  it('passes a complete recipe', () => {
    expect(
      recipeFindings(
        blocks({
          '@type': 'Recipe',
          name: 'Pie',
          image: 'p.jpg',
          recipeIngredient: ['flour'],
          recipeInstructions: ['bake'],
        }),
      ),
    ).toEqual([]);
  });
});

describe('eventFindings', () => {
  it('errors on each missing required field', () => {
    const findings = eventFindings(blocks({ '@type': 'Event' }));
    expect(severities(findings)).toEqual([
      'error',
      'error',
      'error',
      'warning',
    ]);
  });
  it('passes a complete event', () => {
    expect(
      eventFindings(
        blocks({
          '@type': 'Event',
          name: 'Gig',
          startDate: '2026-01-01',
          location: { '@type': 'Place' },
          endDate: '2026-01-02',
        }),
      ),
    ).toEqual([]);
  });
});

describe('videoFindings', () => {
  it('errors on missing required fields and warns on description', () => {
    const findings = videoFindings(blocks({ '@type': 'VideoObject' }));
    expect(severities(findings)).toEqual([
      'error',
      'error',
      'error',
      'warning',
    ]);
  });
  it('passes a complete video', () => {
    expect(
      videoFindings(
        blocks({
          '@type': 'VideoObject',
          name: 'V',
          thumbnailUrl: 't.jpg',
          uploadDate: '2026-01-01',
          description: 'd',
        }),
      ),
    ).toEqual([]);
  });
});

describe('localBusinessFindings', () => {
  it('matches a LocalBusiness subtype by base type', () => {
    const findings = localBusinessFindings(blocks({ '@type': 'Restaurant' }));
    // A bare Restaurant is not matched by the base LocalBusiness type.
    expect(findings).toEqual([]);
  });
  it('errors on missing name and address, warns on recommended', () => {
    const findings = localBusinessFindings(
      blocks({ '@type': 'LocalBusiness' }),
    );
    expect(severities(findings)).toEqual([
      'error',
      'error',
      'warning',
      'warning',
    ]);
  });
  it('passes a complete local business', () => {
    expect(
      localBusinessFindings(
        blocks({
          '@type': 'LocalBusiness',
          name: 'Cafe',
          address: { '@type': 'PostalAddress' },
          openingHours: 'Mo-Fr',
          telephone: '+1',
        }),
      ),
    ).toEqual([]);
  });
});

describe('articleFindings', () => {
  it('only ever warns (Article has no required fields)', () => {
    const findings = articleFindings(blocks({ '@type': 'NewsArticle' }));
    expect(findings).toHaveLength(4);
    expect(severities(findings).every((s) => s === 'warning')).toBe(true);
  });
  it('passes a complete BlogPosting', () => {
    expect(
      articleFindings(
        blocks({
          '@type': 'BlogPosting',
          headline: 'H',
          image: 'i.jpg',
          datePublished: '2026-01-01',
          author: { '@type': 'Person', name: 'A' },
        }),
      ),
    ).toEqual([]);
  });
});

describe('productFindings', () => {
  it('errors on missing name and warns on image and no offers/review/rating', () => {
    const findings = productFindings(blocks({ '@type': 'Product' }));
    expect(findings[0].severity).toBe('error');
    expect(findings.some((f) => f.message.includes('"image"'))).toBe(true);
    expect(findings.some((f) => f.message.includes('no "offers"'))).toBe(true);
  });
  it('validates an Offer needs price and priceCurrency', () => {
    const findings = productFindings(
      blocks({
        '@type': 'Product',
        name: 'P',
        image: 'i.jpg',
        offers: { '@type': 'Offer' },
      }),
    );
    expect(findings.some((f) => f.message.includes('Offer'))).toBe(true);
    expect(findings.filter((f) => f.severity === 'error')).toHaveLength(2);
  });
  it('validates an AggregateOffer needs lowPrice and priceCurrency', () => {
    const findings = productFindings(
      blocks({
        '@type': 'Product',
        name: 'P',
        image: 'i.jpg',
        offers: { '@type': 'AggregateOffer', priceCurrency: 'USD' },
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('lowPrice');
  });
  it('validates aggregateRating needs ratingValue', () => {
    const findings = productFindings(
      blocks({
        '@type': 'Product',
        name: 'P',
        image: 'i.jpg',
        aggregateRating: { '@type': 'AggregateRating' },
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('ratingValue');
  });
  it('validates a review needs a reviewRating ratingValue', () => {
    const findings = productFindings(
      blocks({
        '@type': 'Product',
        name: 'P',
        image: 'i.jpg',
        review: { '@type': 'Review', reviewRating: { '@type': 'Rating' } },
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('reviewRating.ratingValue');
  });
  it('passes a product with a valid offer', () => {
    expect(
      productFindings(
        blocks({
          '@type': 'Product',
          name: 'P',
          image: 'i.jpg',
          offers: { '@type': 'Offer', price: '9.99', priceCurrency: 'USD' },
        }),
      ),
    ).toEqual([]);
  });
});

describe('breadcrumbFindings', () => {
  it('errors on an empty itemListElement', () => {
    const findings = breadcrumbFindings(blocks({ '@type': 'BreadcrumbList' }));
    expect(findings[0].message).toContain('itemListElement');
  });
  it('errors on a listItem without position or name', () => {
    const findings = breadcrumbFindings(
      blocks({
        '@type': 'BreadcrumbList',
        itemListElement: [{ '@type': 'ListItem' }],
      }),
    );
    expect(findings.some((f) => f.message.includes('position'))).toBe(true);
  });
  it('allows the last item to omit its item URL', () => {
    expect(
      breadcrumbFindings(
        blocks({
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
            { '@type': 'ListItem', position: 2, name: 'Here' },
          ],
        }),
      ),
    ).toEqual([]);
  });
});

describe('jobPostingFindings', () => {
  it('errors on each missing required field including jobLocation', () => {
    const findings = jobPostingFindings(blocks({ '@type': 'JobPosting' }));
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors).toHaveLength(5);
  });
  it('does not require jobLocation for a remote role', () => {
    const findings = jobPostingFindings(
      blocks({
        '@type': 'JobPosting',
        title: 'T',
        description: 'D',
        datePosted: '2026-01-01',
        hiringOrganization: { '@type': 'Organization' },
        jobLocationType: 'TELECOMMUTE',
      }),
    );
    expect(findings.filter((f) => f.severity === 'error')).toEqual([]);
  });
});

describe('reviewFindings', () => {
  it('errors when a Review lacks itemReviewed and a rating value', () => {
    const findings = reviewFindings(blocks({ '@type': 'Review' }));
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.severity === 'error')).toBe(true);
  });
  it('errors when an AggregateRating lacks ratingValue or a count', () => {
    const findings = reviewFindings(blocks({ '@type': 'AggregateRating' }));
    expect(findings).toHaveLength(2);
  });
  it('passes a complete review', () => {
    expect(
      reviewFindings(
        blocks({
          '@type': 'Review',
          itemReviewed: { '@type': 'Thing', name: 'X' },
          reviewRating: { '@type': 'Rating', ratingValue: 5 },
        }),
      ),
    ).toEqual([]);
  });
});

describe('websiteSearchActionFindings', () => {
  it('is silent for a WebSite with no SearchAction', () => {
    expect(websiteSearchActionFindings(blocks({ '@type': 'WebSite' }))).toEqual(
      [],
    );
  });
  it('errors on a SearchAction missing target and query-input', () => {
    const findings = websiteSearchActionFindings(
      blocks({
        '@type': 'WebSite',
        potentialAction: { '@type': 'SearchAction' },
      }),
    );
    expect(findings).toHaveLength(2);
  });
  it('passes a complete SearchAction', () => {
    expect(
      websiteSearchActionFindings(
        blocks({
          '@type': 'WebSite',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://x.test/s?q={q}',
            'query-input': 'required name=q',
          },
        }),
      ),
    ).toEqual([]);
  });
});
