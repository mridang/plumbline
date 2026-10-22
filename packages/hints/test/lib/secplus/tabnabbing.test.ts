import { describe, expect, it } from '@jest/globals';
import {
  isCrossOrigin,
  isUnsafeTabnabbing,
  tabnabbingFinding,
  tabnabbingFindings,
} from '../../../src/lib/secplus/tabnabbing.js';

const PAGE = 'https://example.test/page';

describe('isCrossOrigin', () => {
  it('is false for a same-origin absolute URL', () => {
    expect(isCrossOrigin('https://example.test/other', PAGE)).toBe(false);
  });

  it('is false for a relative URL', () => {
    expect(isCrossOrigin('/other', PAGE)).toBe(false);
  });

  it('is true for a different origin', () => {
    expect(isCrossOrigin('https://evil.test/', PAGE)).toBe(true);
  });

  it('is false for a non-HTTP scheme', () => {
    expect(isCrossOrigin('mailto:a@b.test', PAGE)).toBe(false);
    expect(isCrossOrigin('javascript:void 0', PAGE)).toBe(false);
  });

  it('is false for a null href', () => {
    expect(isCrossOrigin(null, PAGE)).toBe(false);
  });
});

describe('isUnsafeTabnabbing', () => {
  it('flags a cross-origin _blank link without rel', () => {
    expect(
      isUnsafeTabnabbing(
        { target: '_blank', rel: null, href: 'https://evil.test/' },
        PAGE,
      ),
    ).toBe(true);
  });

  it('accepts rel=noopener', () => {
    expect(
      isUnsafeTabnabbing(
        { target: '_blank', rel: 'noopener', href: 'https://evil.test/' },
        PAGE,
      ),
    ).toBe(false);
  });

  it('accepts rel=noreferrer', () => {
    expect(
      isUnsafeTabnabbing(
        { target: '_blank', rel: 'noreferrer', href: 'https://evil.test/' },
        PAGE,
      ),
    ).toBe(false);
  });

  it('accepts rel with several tokens including noopener', () => {
    expect(
      isUnsafeTabnabbing(
        {
          target: '_blank',
          rel: 'external NOOPENER nofollow',
          href: 'https://evil.test/',
        },
        PAGE,
      ),
    ).toBe(false);
  });

  it('ignores a same-origin link', () => {
    expect(
      isUnsafeTabnabbing(
        { target: '_blank', rel: null, href: 'https://example.test/x' },
        PAGE,
      ),
    ).toBe(false);
  });

  it('ignores a non-_blank target', () => {
    expect(
      isUnsafeTabnabbing(
        { target: '_self', rel: null, href: 'https://evil.test/' },
        PAGE,
      ),
    ).toBe(false);
  });

  it('matches _blank case-insensitively', () => {
    expect(
      isUnsafeTabnabbing(
        { target: '_BLANK', rel: null, href: 'https://evil.test/' },
        PAGE,
      ),
    ).toBe(true);
  });
});

describe('tabnabbingFinding', () => {
  it('returns an error finding naming the href', () => {
    const found = tabnabbingFinding(
      { target: '_blank', rel: null, href: 'https://evil.test/' },
      PAGE,
    );
    expect(found?.severity).toBe('error');
    expect(found?.message).toContain('https://evil.test/');
  });

  it('returns null for a safe anchor', () => {
    expect(
      tabnabbingFinding(
        { target: '_blank', rel: 'noopener', href: 'https://evil.test/' },
        PAGE,
      ),
    ).toBeNull();
  });
});

describe('tabnabbingFindings', () => {
  it('returns one finding per unsafe anchor and skips safe ones', () => {
    const findings = tabnabbingFindings(
      [
        { target: '_blank', rel: null, href: 'https://a.test/' },
        { target: '_blank', rel: 'noopener', href: 'https://b.test/' },
        { target: '_blank', rel: null, href: '/relative' },
        { target: '_blank', rel: null, href: 'https://c.test/' },
      ],
      PAGE,
    );
    expect(findings).toHaveLength(2);
  });

  it('returns nothing for no anchors', () => {
    expect(tabnabbingFindings([], PAGE)).toEqual([]);
  });
});
