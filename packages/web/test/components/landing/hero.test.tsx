import { describe, expect, it } from '@jest/globals';

import { Hero } from '@/components/landing/hero';
import { RULE_SOURCES } from '@/components/landing/sources';
import { html } from '../render';

describe('Hero', () => {
  const out = html(<Hero checks={267} />);

  it('says how many checks there are', () => {
    expect(out).toContain('267 checks');
  });

  it('heads the page', () => {
    expect(out).toMatch(/<h1[^>]*>Find what your website gets wrong/);
  });

  it('offers the scanner first, on the card the header links to', () => {
    expect(out).toContain('id="scan"');
    expect(out).toContain('role="search"');
  });

  it('says a page can be checked once every five minutes', () => {
    expect(out).toContain('once every five minutes');
  });

  it('names and links every reference the rules come from', () => {
    for (const source of RULE_SOURCES) {
      expect(out).toContain(`href="${source.url}"`);
      expect(out).toContain(`>${source.name}</a>`);
    }
  });
});
