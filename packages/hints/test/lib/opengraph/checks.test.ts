import { describe, expect, it } from '@jest/globals';
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
  ogImageBroken,
  ogImageDimensionsMissing,
  ogImageDimensionsTooLarge,
  ogImageMissing,
  ogImageNonOptimalSize,
  ogImageNotHttps,
  ogImageTooLarge,
  ogImageTooSmall,
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
  type OgImage,
} from '../../../src/lib/opengraph/checks.js';
import { HTTP_SCHEME } from '../../helpers/data.js';

/** Builds a `meta(key)` reader over a plain map of tag values. */
function meta(
  values: Readonly<Record<string, string>>,
): (key: string) => string | null {
  return (key) => values[key] ?? null;
}

/** Builds an `OgImage` with sensible 2xx/image defaults, overridable. */
function image(over: Partial<OgImage> = {}): OgImage {
  return {
    url: 'https://example.com/og.png',
    status: 200,
    contentType: 'image/png',
    size: 100 * 1024,
    info: { format: 'png', width: 1200, height: 630 },
    ...over,
  };
}

describe('ogTitleMissing', () => {
  it('errors when og:title is absent', () => {
    const [f] = ogTitleMissing({ meta: meta({}) });
    expect(f.severity).toBe('error');
    expect(f.message).toContain('no og:title');
  });
  it('passes when og:title is present', () => {
    expect(ogTitleMissing({ meta: meta({ 'og:title': 'A title' }) })).toEqual(
      [],
    );
  });
});

describe('ogTitleTooLong', () => {
  it('warns above 60 characters with the exact count', () => {
    const [f] = ogTitleTooLong({ meta: meta({ 'og:title': 'x'.repeat(61) }) });
    expect(f.severity).toBe('warning');
    expect(f.message).toContain('61 characters');
  });
  it('passes at the 60 character boundary and when absent', () => {
    expect(
      ogTitleTooLong({ meta: meta({ 'og:title': 'x'.repeat(60) }) }),
    ).toEqual([]);
    expect(ogTitleTooLong({ meta: meta({}) })).toEqual([]);
  });
});

describe('ogTitleTooShort', () => {
  it('hints below 15 characters but never when absent', () => {
    const [f] = ogTitleTooShort({ meta: meta({ 'og:title': 'short' }) });
    expect(f.severity).toBe('hint');
    expect(f.message).toContain('5 characters');
    expect(ogTitleTooShort({ meta: meta({}) })).toEqual([]);
    expect(
      ogTitleTooShort({ meta: meta({ 'og:title': 'x'.repeat(15) }) }),
    ).toEqual([]);
  });
});

describe('ogDescriptionMissing', () => {
  it('errors when absent, passes when present', () => {
    expect(ogDescriptionMissing({ meta: meta({}) })[0].severity).toBe('error');
    expect(
      ogDescriptionMissing({ meta: meta({ 'og:description': 'x' }) }),
    ).toEqual([]);
  });
});

describe('ogDescriptionTooLong', () => {
  it('warns above 160 characters', () => {
    const [f] = ogDescriptionTooLong({
      meta: meta({ 'og:description': 'x'.repeat(161) }),
    });
    expect(f.severity).toBe('warning');
    expect(f.message).toContain('161 characters');
    expect(
      ogDescriptionTooLong({
        meta: meta({ 'og:description': 'x'.repeat(160) }),
      }),
    ).toEqual([]);
  });
});

describe('ogDescriptionSlightlyLong', () => {
  it('hints on 161 to 200 only', () => {
    expect(
      ogDescriptionSlightlyLong({
        meta: meta({ 'og:description': 'x'.repeat(180) }),
      })[0].severity,
    ).toBe('hint');
    expect(
      ogDescriptionSlightlyLong({
        meta: meta({ 'og:description': 'x'.repeat(160) }),
      }),
    ).toEqual([]);
    expect(
      ogDescriptionSlightlyLong({
        meta: meta({ 'og:description': 'x'.repeat(201) }),
      }),
    ).toEqual([]);
  });
});

describe('ogDescriptionTooShort', () => {
  it('hints below 50 characters, never when absent', () => {
    expect(
      ogDescriptionTooShort({
        meta: meta({ 'og:description': 'x'.repeat(49) }),
      })[0].severity,
    ).toBe('hint');
    expect(ogDescriptionTooShort({ meta: meta({}) })).toEqual([]);
    expect(
      ogDescriptionTooShort({
        meta: meta({ 'og:description': 'x'.repeat(50) }),
      }),
    ).toEqual([]);
  });
});

describe('ogDescriptionCouldBeLonger', () => {
  it('hints on 50 to 70 inclusive', () => {
    expect(
      ogDescriptionCouldBeLonger({
        meta: meta({ 'og:description': 'x'.repeat(50) }),
      }),
    ).toHaveLength(1);
    expect(
      ogDescriptionCouldBeLonger({
        meta: meta({ 'og:description': 'x'.repeat(70) }),
      }),
    ).toHaveLength(1);
    expect(
      ogDescriptionCouldBeLonger({
        meta: meta({ 'og:description': 'x'.repeat(71) }),
      }),
    ).toEqual([]);
  });
});

describe('ogDescriptionIsUrl', () => {
  it('warns when it starts with a URL', () => {
    expect(
      ogDescriptionIsUrl({
        meta: meta({ 'og:description': 'https://x.com here' }),
      })[0].severity,
    ).toBe('warning');
    expect(
      ogDescriptionIsUrl({ meta: meta({ 'og:description': 'A summary' }) }),
    ).toEqual([]);
  });
});

describe('ogDescriptionSameAsTitle', () => {
  it('warns when description equals title (normalized)', () => {
    expect(
      ogDescriptionSameAsTitle({
        meta: meta({
          'og:title': 'Hello World',
          'og:description': 'hello   world',
        }),
      }),
    ).toHaveLength(1);
    expect(
      ogDescriptionSameAsTitle({
        meta: meta({ 'og:title': 'A', 'og:description': 'B' }),
      }),
    ).toEqual([]);
  });
});

describe('ogDescriptionKeywordStuffing', () => {
  it('warns on repeated words', () => {
    expect(
      ogDescriptionKeywordStuffing({
        meta: meta({
          'og:description': 'widgets widgets widgets widgets premium widgets',
        }),
      }),
    ).toHaveLength(1);
    expect(
      ogDescriptionKeywordStuffing({
        meta: meta({
          'og:description': 'a natural human sentence about things',
        }),
      }),
    ).toEqual([]);
  });
});

describe('the simple presence checks', () => {
  it('og:url warns, og:type/site_name/locale hint', () => {
    expect(ogUrlMissing({ meta: meta({}) })[0].severity).toBe('warning');
    expect(ogTypeMissing({ meta: meta({}) })[0].severity).toBe('hint');
    expect(ogSiteNameMissing({ meta: meta({}) })[0].severity).toBe('hint');
    expect(ogLocaleMissing({ meta: meta({}) })[0].severity).toBe('hint');
    expect(ogUrlMissing({ meta: meta({ 'og:url': 'x' }) })).toEqual([]);
  });
});

describe('ogImageMissing', () => {
  it('errors when absent', () => {
    expect(ogImageMissing({ meta: meta({}) })[0].severity).toBe('error');
    expect(ogImageMissing({ meta: meta({ 'og:image': 'x' }) })).toEqual([]);
  });
});

describe('ogImageNotHttps', () => {
  it('warns on http:// only', () => {
    expect(
      ogImageNotHttps({
        meta: meta({ 'og:image': `${HTTP_SCHEME}x/og.png` }),
      })[0].severity,
    ).toBe('warning');
    expect(
      ogImageNotHttps({ meta: meta({ 'og:image': 'https://x/og.png' }) }),
    ).toEqual([]);
    expect(ogImageNotHttps({ meta: meta({}) })).toEqual([]);
  });
});

describe('ogImageDimensionsMissing', () => {
  it('lists the absent dimension tags, only when an image exists', () => {
    const [f] = ogImageDimensionsMissing({
      meta: meta({ 'og:image': 'x', 'og:image:width': '1200' }),
    });
    expect(f.message).toContain('og:image:height');
    expect(f.message).not.toContain('og:image:width or');
    expect(ogImageDimensionsMissing({ meta: meta({}) })).toEqual([]);
    expect(
      ogImageDimensionsMissing({
        meta: meta({
          'og:image': 'x',
          'og:image:width': '1',
          'og:image:height': '1',
        }),
      }),
    ).toEqual([]);
  });
});

describe('ogImageAltMissing', () => {
  it('hints when alt is absent, only when an image exists', () => {
    expect(
      ogImageAltMissing({ meta: meta({ 'og:image': 'x' }) })[0].severity,
    ).toBe('hint');
    expect(ogImageAltMissing({ meta: meta({}) })).toEqual([]);
    expect(
      ogImageAltMissing({
        meta: meta({ 'og:image': 'x', 'og:image:alt': 'a' }),
      }),
    ).toEqual([]);
  });
});

describe('ogImageBroken', () => {
  it('passes with no image', () => {
    expect(ogImageBroken({ image: null })).toEqual([]);
  });
  it('errors on an unreachable, non-2xx or non-image response', () => {
    expect(ogImageBroken({ image: image({ status: 0 }) })[0].message).toContain(
      'could not be fetched',
    );
    expect(
      ogImageBroken({ image: image({ status: 404 }) })[0].message,
    ).toContain('HTTP 404');
    expect(
      ogImageBroken({ image: image({ contentType: 'text/html' }) })[0].message,
    ).toContain('not an image');
  });
  it('passes on a 2xx image', () => {
    expect(ogImageBroken({ image: image() })).toEqual([]);
  });
});

describe('ogImageTooSmall', () => {
  it('errors below 400x256', () => {
    expect(
      ogImageTooSmall({
        image: image({ info: { format: 'png', width: 399, height: 630 } }),
      })[0].severity,
    ).toBe('error');
    expect(ogImageTooSmall({ image: image() })).toEqual([]);
    expect(ogImageTooSmall({ image: null })).toEqual([]);
  });
});

describe('ogImageDimensionsTooLarge', () => {
  it('warns above 4096 on a side', () => {
    expect(
      ogImageDimensionsTooLarge({
        image: image({ info: { format: 'png', width: 5000, height: 630 } }),
      })[0].severity,
    ).toBe('warning');
    expect(ogImageDimensionsTooLarge({ image: image() })).toEqual([]);
  });
});

describe('ogImageTooLarge', () => {
  it('warns above 500 KB only for a 2xx image', () => {
    expect(
      ogImageTooLarge({ image: image({ size: 600 * 1024 }) })[0].severity,
    ).toBe('warning');
    expect(
      ogImageTooLarge({ image: image({ size: 600 * 1024, status: 404 }) }),
    ).toEqual([]);
    expect(ogImageTooLarge({ image: image() })).toEqual([]);
  });
});

describe('ogImageNonOptimalSize', () => {
  it('accepts the three canonical sizes and hints otherwise', () => {
    expect(ogImageNonOptimalSize({ image: image() })).toEqual([]);
    expect(
      ogImageNonOptimalSize({
        image: image({ info: { format: 'png', width: 2400, height: 1260 } }),
      }),
    ).toEqual([]);
    expect(
      ogImageNonOptimalSize({
        image: image({ info: { format: 'png', width: 1000, height: 1000 } }),
      })[0].severity,
    ).toBe('hint');
    expect(ogImageNonOptimalSize({ image: null })).toEqual([]);
  });
});

describe('the twitter checks', () => {
  it('twitter:card/title/description/image warn, site hints', () => {
    expect(twitterCardMissing({ meta: meta({}) })[0].severity).toBe('warning');
    expect(twitterTitleMissing({ meta: meta({}) })[0].severity).toBe('warning');
    expect(twitterDescriptionMissing({ meta: meta({}) })[0].severity).toBe(
      'warning',
    );
    expect(twitterSiteMissing({ meta: meta({}) })[0].severity).toBe('hint');
  });

  it('twitter-card-not-large fires only for summary with an image', () => {
    expect(
      twitterCardNotLarge({
        meta: meta({ 'twitter:card': 'summary', 'og:image': 'x' }),
      }),
    ).toHaveLength(1);
    expect(
      twitterCardNotLarge({ meta: meta({ 'twitter:card': 'summary' }) }),
    ).toEqual([]);
    expect(
      twitterCardNotLarge({
        meta: meta({ 'twitter:card': 'summary_large_image', 'og:image': 'x' }),
      }),
    ).toEqual([]);
  });

  it('twitter-image-missing fires only without an og:image fallback', () => {
    expect(twitterImageMissing({ meta: meta({}) })).toHaveLength(1);
    expect(twitterImageMissing({ meta: meta({ 'og:image': 'x' }) })).toEqual(
      [],
    );
  });
});
