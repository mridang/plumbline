import { describe, expect, it } from '@jest/globals';

import { jsonLdText, landingJsonLd } from '@/lib/core/seo';
import {
  SITE_APPLICATION_CATEGORY,
  SITE_FEATURES,
  SITE_REQUIREMENTS,
} from '@/utils/site';

describe('landingJsonLd', () => {
  const graph = landingJsonLd()['@graph'] as Record<string, unknown>[];
  const byType = (type: string) => graph.find((n) => n['@type'] === type)!;

  it('describes the organisation, the site and the app', () => {
    expect(graph.map((n) => n['@type'])).toEqual([
      'Organization',
      'WebSite',
      'WebApplication',
    ]);
  });

  it('gives every node a stable id that the others point at', () => {
    const ids = graph.map((n) => n['@id']);
    expect(new Set(ids).size).toBe(3);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the test reads this value as { '@id': string; }, which the values it was built from or the checks around it establish
    expect((byType('WebSite')['publisher'] as { '@id': string })['@id']).toBe(
      byType('Organization')['@id'],
    );
  });

  it('says the app is free and works anywhere with a browser', () => {
    const app = byType('WebApplication');
    expect(app['isAccessibleForFree']).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the test reads this value as { price: string; }, which the values it was built from or the checks around it establish
    expect((app['offers'] as { price: string }).price).toBe('0');
    expect(app['operatingSystem']).toBe('Any');
  });

  it("takes what is particular to the app from the site's constants", () => {
    const app = byType('WebApplication');
    expect(app['applicationCategory']).toBe(SITE_APPLICATION_CATEGORY);
    expect(app['browserRequirements']).toBe(SITE_REQUIREMENTS);
    expect(app['featureList']).toEqual(SITE_FEATURES);
    expect(SITE_FEATURES.length).toBeGreaterThan(0);
  });
});

describe('jsonLdText', () => {
  it('can never close the script tag it is placed in', () => {
    const text = jsonLdText({ name: '</script><script>alert(1)</script>' });
    expect(text).not.toContain('<');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns any, and the test reads the parsed text as the shape its fixture wrote
    expect((JSON.parse(text) as { name: string }).name).toBe(
      '</script><script>alert(1)</script>',
    );
  });
});
