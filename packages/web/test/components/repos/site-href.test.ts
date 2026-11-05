import { describe, expect, it } from '@jest/globals';

import { siteHref } from '@/components/repos/site-href';

describe('siteHref', () => {
  it('names the repository page and the site tab', () => {
    expect(siteHref('acme/site', 'a.example.com')).toBe(
      '/repos/acme/site?site=a.example.com',
    );
  });

  it('adds the report or the settings view when asked', () => {
    expect(siteHref('acme/site', 'a.test', { report: 's12' })).toBe(
      '/repos/acme/site?site=a.test&report=s12',
    );
    expect(siteHref('acme/site', 'a.test', { view: 'settings' })).toBe(
      '/repos/acme/site?site=a.test&view=settings',
    );
  });

  it('escapes what is not safe in an address', () => {
    expect(siteHref('acme/site', 'a b.test')).toBe(
      '/repos/acme/site?site=a+b.test',
    );
  });
});
