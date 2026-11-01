import { describe, expect, it } from '@jest/globals';
import {
  findLegalLink,
  PRIVACY_POLICY_LINK_REF,
  privacyPolicyLinkMissing,
  TERMS_OF_SERVICE_LINK_REF,
  termsOfServiceLinkMissing,
  type DocumentLike,
} from '../../../src/lib/privacy/legal-links.js';

/** One element of the fake document: its tag, text and attributes. */
interface FakeElement {
  tag: 'a' | 'link';
  text?: string;
  href?: string;
  rel?: string;
}

/**
 * A fake document. `a[href]` returns only the anchors with an address, and
 * `a[href], link[href]` the anchors and `<link>`s with one, as a DOM would.
 */
function doc(elements: readonly FakeElement[]): DocumentLike {
  return {
    querySelectorAll: (selector: string) =>
      elements
        .filter((element) => element.href !== undefined)
        .filter((element) => selector.includes(`${element.tag}[href]`))
        .map((element) => ({
          textContent: element.text ?? '',
          getAttribute: (name: string) =>
            (name === 'href'
              ? element.href
              : name === 'rel'
                ? element.rel
                : undefined) ?? null,
        })),
  };
}

describe('findLegalLink', () => {
  it('finds a privacy policy by the link text', () => {
    expect(
      findLegalLink(
        doc([{ tag: 'a', text: 'Privacy Policy', href: '/legal/p1' }]),
        'privacy-policy',
      ),
    ).toBe('/legal/p1');
  });

  it('finds a privacy policy by its address when the text says nothing', () => {
    expect(
      findLegalLink(
        doc([{ tag: 'a', text: 'Read more', href: '/en/privacy-notice' }]),
        'privacy-policy',
      ),
    ).toBe('/en/privacy-notice');
  });

  it.each([
    ['Datenschutzerklärung', 'privacy-policy'],
    ['Política de privacidad', 'privacy-policy'],
    ['Politique de confidentialité', 'privacy-policy'],
    ['Privacybeleid', 'privacy-policy'],
    ['Terms of Service', 'terms-of-service'],
    ['Terms & Conditions', 'terms-of-service'],
    ['Conditions of use', 'terms-of-service'],
    ['T&Cs', 'terms-of-service'],
    ['AGB', 'terms-of-service'],
    ['Nutzungsbedingungen', 'terms-of-service'],
    ['Algemene voorwaarden', 'terms-of-service'],
  ] as const)('reads “%s” as the %s', (text, page) => {
    expect(findLegalLink(doc([{ tag: 'a', text, href: '/x' }]), page)).toBe(
      '/x',
    );
  });

  it.each([
    ['/terms', 'terms-of-service'],
    ['/tos', 'terms-of-service'],
    ['/legal/tos.html', 'terms-of-service'],
    ['/agb', 'terms-of-service'],
    ['/datenschutz', 'privacy-policy'],
    ['https://example.com/privacy?lang=en', 'privacy-policy'],
  ] as const)('reads the address %s as the %s', (href, page) => {
    expect(findLegalLink(doc([{ tag: 'a', text: 'Here', href }]), page)).toBe(
      href,
    );
  });

  it('does not take a word that merely contains “tos” or “agb” for the terms', () => {
    expect(
      findLegalLink(
        doc([
          { tag: 'a', text: 'Photos', href: '/photos' },
          { tag: 'a', text: 'Bags', href: '/bagbuilder' },
        ]),
        'terms-of-service',
      ),
    ).toBeUndefined();
  });

  it.each(['/2026-midterms/', '/ausland/midterms-trump', '/en/2026-midterms/'])(
    'does not take a word that ends in “terms”, as in %s, for the terms',
    (href) => {
      expect(
        findLegalLink(
          doc([{ tag: 'a', text: 'Read', href }]),
          'terms-of-service',
        ),
      ).toBeUndefined();
    },
  );

  it('does not take an article slug that mentions the terms for them', () => {
    expect(
      findLegalLink(
        doc([
          {
            tag: 'a',
            text: '',
            href: '/environment/2026/oct/27/i-struggled-to-come-to-terms-with-my-mums-death',
          },
        ]),
        'terms-of-service',
      ),
    ).toBeUndefined();
  });

  it('reads the page from any short segment, not only the last', () => {
    expect(
      findLegalLink(
        doc([{ tag: 'a', text: 'Read', href: '/privacy-policy/en' }]),
        'privacy-policy',
      ),
    ).toBe('/privacy-policy/en');
  });

  it('does not take a “how-tos” segment for the terms', () => {
    expect(
      findLegalLink(
        doc([
          {
            tag: 'a',
            text: 'Customize Copilot',
            href: 'https://docs.github.com/en/copilot/how-tos/overview',
          },
        ]),
        'terms-of-service',
      ),
    ).toBeUndefined();
  });

  it('does not read a headline that mentions the page as a link to it', () => {
    expect(
      findLegalLink(
        doc([
          {
            tag: 'a',
            text: 'New privacy terms and conditions agreed for cloud services in the EU',
            href: '/news/12345',
          },
        ]),
        'terms-of-service',
      ),
    ).toBeUndefined();
  });

  it('still reads a short footer link of fifty characters', () => {
    expect(
      findLegalLink(
        doc([{ tag: 'a', text: 'Terms'.padEnd(50, '.'), href: '/x' }]),
        'terms-of-service',
      ),
    ).toBe('/x');
  });

  it('takes a link with the registered relation, on <a> or <link>, whatever its text', () => {
    expect(
      findLegalLink(
        doc([{ tag: 'link', rel: 'privacy-policy', href: '/p' }]),
        'privacy-policy',
      ),
    ).toBe('/p');
    expect(
      findLegalLink(
        doc([
          { tag: 'a', rel: 'nofollow Terms-Of-Service', text: '§', href: '/t' },
        ]),
        'terms-of-service',
      ),
    ).toBe('/t');
  });

  it('prefers the registered relation over a link that only names the page', () => {
    expect(
      findLegalLink(
        doc([
          { tag: 'a', text: 'Privacy', href: '/blog/privacy-tips' },
          { tag: 'link', rel: 'privacy-policy', href: '/policy' },
        ]),
        'privacy-policy',
      ),
    ).toBe('/policy');
  });

  it('does not read a <link> by its address alone', () => {
    expect(
      findLegalLink(
        doc([{ tag: 'link', rel: 'stylesheet', href: '/privacy.css' }]),
        'privacy-policy',
      ),
    ).toBeUndefined();
  });

  it.each(['', '#', 'javascript:openPrivacy()', 'mailto:privacy@example.com'])(
    'skips the address %p, which is not a page',
    (href) => {
      expect(
        findLegalLink(
          doc([{ tag: 'a', text: 'Privacy', href }]),
          'privacy-policy',
        ),
      ).toBeUndefined();
    },
  );

  it('ignores anchors without an address', () => {
    expect(
      findLegalLink(doc([{ tag: 'a', text: 'Privacy' }]), 'privacy-policy'),
    ).toBeUndefined();
  });

  it('is undefined on a page with no links', () => {
    expect(findLegalLink(doc([]), 'terms-of-service')).toBeUndefined();
  });
});

describe('privacyPolicyLinkMissing', () => {
  it('finds nothing when the page links its privacy policy', () => {
    expect(
      privacyPolicyLinkMissing(
        doc([{ tag: 'a', text: 'Privacy', href: '/privacy' }]),
      ),
    ).toEqual([]);
  });

  it('warns, with the reference, when it does not', () => {
    expect(
      privacyPolicyLinkMissing(
        doc([{ tag: 'a', text: 'Terms', href: '/terms' }]),
      ),
    ).toEqual([
      {
        severity: 'warning',
        message: `The page links to no privacy policy. Link it from the home page, for example in the footer, so visitors and app reviewers can find it. Read more: ${PRIVACY_POLICY_LINK_REF}`,
      },
    ]);
  });
});

describe('termsOfServiceLinkMissing', () => {
  it('finds nothing when the page links its terms', () => {
    expect(
      termsOfServiceLinkMissing(
        doc([{ tag: 'a', text: 'Terms of use', href: '/legal' }]),
      ),
    ).toEqual([]);
  });

  it('warns, with the reference, when it does not', () => {
    expect(
      termsOfServiceLinkMissing(
        doc([{ tag: 'a', text: 'Privacy', href: '/privacy' }]),
      ),
    ).toEqual([
      {
        severity: 'warning',
        message: `The page links to no terms of service. Link them from the home page, for example in the footer, next to the privacy policy. Read more: ${TERMS_OF_SERVICE_LINK_REF}`,
      },
    ]);
  });
});
