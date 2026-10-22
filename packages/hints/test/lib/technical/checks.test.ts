import { describe, expect, it } from '@jest/globals';
import {
  canonicalInvalidFindings,
  headingHierarchyFindings,
  imageAltCoverageFindings,
  imageWeightFinding,
  robotsMetaAdvancedFindings,
  twitterCardTypeFindings,
} from '../../../src/lib/technical/checks.js';
import type {
  AltCoverage,
  RobotsAdvanced,
} from '../../../src/lib/technical/read.js';

describe('headingHierarchyFindings', () => {
  it('is empty when the outline never skips a level', () => {
    expect(headingHierarchyFindings(null)).toEqual([]);
  });
  it('warns, naming the levels, when a level is skipped', () => {
    const [f] = headingHierarchyFindings({ from: 2, to: 4, index: 3 });
    expect(f.severity).toBe('warning');
    expect(f.message).toBe(
      'Heading hierarchy skips a level (h2 is directly followed by h4). Avoid skipping heading levels.',
    );
  });
});

describe('imageAltCoverageFindings', () => {
  it('is empty when there is nothing to report', () => {
    expect(imageAltCoverageFindings(null)).toEqual([]);
  });
  it('errors below the threshold', () => {
    const coverage: AltCoverage = {
      total: 10,
      missing: 4,
      percent: 60,
      failing: true,
    };
    const [f] = imageAltCoverageFindings(coverage);
    expect(f.severity).toBe('error');
    expect(f.message).toBe(
      '4 of 10 <img> tags are missing an alt attribute (60% coverage). Add descriptive alt text, or alt="" for purely decorative images.',
    );
  });
  it('advises at or above the threshold', () => {
    const coverage: AltCoverage = {
      total: 10,
      missing: 2,
      percent: 80,
      failing: false,
    };
    expect(imageAltCoverageFindings(coverage)[0].severity).toBe('warning');
  });
});

describe('robotsMetaAdvancedFindings', () => {
  const robots = (over: Partial<RobotsAdvanced>): RobotsAdvanced => ({
    content: '',
    present: [],
    missing: ['max-snippet', 'max-image-preview', 'max-video-preview'],
    ...over,
  });

  it('warns when the robots meta tag is absent', () => {
    const [f] = robotsMetaAdvancedFindings(robots({ content: '' }));
    expect(f.message).toContain('No meta robots directives found');
  });
  it('skips a noindex page', () => {
    expect(robotsMetaAdvancedFindings(robots({ content: 'noindex' }))).toEqual(
      [],
    );
  });
  it('warns when no advanced directive is present', () => {
    const [f] = robotsMetaAdvancedFindings(
      robots({ content: 'index, follow' }),
    );
    expect(f.message).toContain('no advanced snippet/preview directives');
  });
  it('warns when some advanced directives are missing', () => {
    const [f] = robotsMetaAdvancedFindings(
      robots({
        content: 'max-snippet:-1',
        present: ['max-snippet'],
        missing: ['max-image-preview', 'max-video-preview'],
      }),
    );
    expect(f.message).toBe(
      'Meta robots tag has max-snippet, but is missing: max-image-preview, max-video-preview.',
    );
  });
  it('is empty when every advanced directive is present', () => {
    expect(
      robotsMetaAdvancedFindings(
        robots({
          content:
            'max-snippet:-1, max-image-preview:large, max-video-preview:-1',
          present: ['max-snippet', 'max-image-preview', 'max-video-preview'],
          missing: [],
        }),
      ),
    ).toEqual([]);
  });
});

describe('twitterCardTypeFindings', () => {
  it('is empty when the tag is absent', () => {
    expect(twitterCardTypeFindings(null)).toEqual([]);
  });
  it('is empty for a recognised type', () => {
    expect(twitterCardTypeFindings('summary_large_image')).toEqual([]);
  });
  it('errors on an unrecognised type', () => {
    const [f] = twitterCardTypeFindings('bogus');
    expect(f.severity).toBe('error');
    expect(f.message).toBe(
      'twitter:card value "bogus" is not a recognized card type. Use one of: summary, summary_large_image, app, player.',
    );
  });
});

describe('canonicalInvalidFindings', () => {
  it('is empty when there is no canonical link', () => {
    expect(canonicalInvalidFindings(null, 'https://x.test/')).toEqual([]);
  });
  it('accepts a relative href that resolves', () => {
    expect(canonicalInvalidFindings('/page', 'https://x.test/')).toEqual([]);
  });
  it('errors on an href that does not resolve', () => {
    const [f] = canonicalInvalidFindings('http://', 'https://x.test/');
    expect(f.severity).toBe('error');
    expect(f.message).toBe('Canonical href "http://" is not a valid URL.');
  });
});

describe('imageWeightFinding', () => {
  const url = 'https://x.test/a.png';
  it('is null for a light image', () => {
    expect(imageWeightFinding(url, 1024)).toBeNull();
  });
  it('advises over 200 KB', () => {
    const f = imageWeightFinding(url, 300 * 1024);
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('keep images under 200 KB');
  });
  it('errors over 500 KB', () => {
    const f = imageWeightFinding(url, 600 * 1024);
    expect(f?.severity).toBe('error');
    expect(f?.message).toContain('keep images under 500 KB');
  });
});
