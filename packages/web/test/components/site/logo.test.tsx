import { describe, expect, it } from '@jest/globals';

import { BrandMark, Logo } from '@/components/site/logo';
// eslint-disable-next-line unicorn/no-keyword-prefix -- classOf is the shared test helper exported by render.ts
import { classOf, html } from '../render';

/** Matches home link opening. */
const HOME_LINK_OPENING = /^<a href="\/"/u;

describe('BrandMark', () => {
  it('is a decorative drawing in the brand colour, sized by its class', () => {
    const out = html(<BrandMark className="size-14" />);
    expect(out).toContain('aria-hidden="true"');
    const classes = classOf(out, 'svg');
    expect(classes).toContain('text-brand');
    expect(classes).toContain('size-14');
  });
});

describe('Logo', () => {
  it('links home with the mark and the name', () => {
    const out = html(<Logo />);
    expect(out).toMatch(HOME_LINK_OPENING);
    expect(out).toContain('<svg');
    expect(out).toContain('Plumbline</a>');
  });
});
