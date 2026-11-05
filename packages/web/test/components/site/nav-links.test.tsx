import { describe, expect, it } from '@jest/globals';

import {
  NavLinks,
  NavMenu,
  SIGNED_IN_LINKS,
  SIGNED_OUT_LINKS,
  isCurrent,
} from '@/components/site/nav-links';
import { htmlAt } from '../render';

const DASHBOARD = SIGNED_IN_LINKS[0]!;

describe('isCurrent', () => {
  it('is the page itself and the pages under it', () => {
    expect(isCurrent('/dashboard', DASHBOARD)).toBe(true);
    expect(isCurrent('/repos/acme/site', DASHBOARD)).toBe(true);
    expect(isCurrent('/github', DASHBOARD)).toBe(true);
  });

  it('is not a page that only starts with the same letters', () => {
    expect(isCurrent('/dashboards', DASHBOARD)).toBe(false);
    expect(isCurrent('/checks', DASHBOARD)).toBe(false);
  });
});

describe('the links', () => {
  it('give a signed-in person the dashboard first, then the references', () => {
    expect(SIGNED_IN_LINKS.map((link) => link.label)).toEqual([
      'Dashboard',
      'Checks',
      'Docs',
    ]);
  });

  it('give a visitor the references only', () => {
    expect(SIGNED_OUT_LINKS.map((link) => link.label)).toEqual([
      'Checks',
      'Docs',
    ]);
  });
});

describe('NavLinks', () => {
  it('is out of sight on phones, which have the menu', () => {
    expect(
      htmlAt(<NavLinks links={SIGNED_OUT_LINKS} />, { pathname: '/' }),
    ).toContain('hidden');
  });

  it('marks only the current link', () => {
    const out = htmlAt(<NavLinks links={SIGNED_IN_LINKS} />, {
      pathname: '/docs',
    });
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-current="page"[^>]*>Docs</);
  });
});

describe('NavMenu', () => {
  it('is only for phones', () => {
    expect(
      htmlAt(<NavMenu links={SIGNED_OUT_LINKS} />, { pathname: '/' }),
    ).toContain('md:hidden');
  });
});
