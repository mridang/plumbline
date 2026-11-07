import { describe, expect, it } from '@jest/globals';

import { SiteActions, sitePageOf } from '@/components/repos/site-actions';
import { htmlAt } from '../render';

describe('sitePageOf', () => {
  it('is the site’s tab on its repository’s page', () => {
    expect(sitePageOf('acme/site', { id: 'a', host: 'x.test' })).toBe(
      '/repos/acme/site?site=x.test',
    );
  });

  it('is the old page of a site added by hand', () => {
    expect(sitePageOf(null, { id: 'abc', host: 'x.test' })).toBe(
      '/domains/abc',
    );
  });
});

describe('SiteActions', () => {
  it('is a menu named for the repository, closed until it is opened', () => {
    const out = htmlAt(
      <SiteActions
        repo="acme/site"
        site={{ id: 'a', host: 'x.test' }}
        paused={false}
        control={{ canManage: true, fileOff: false }}
      />,
    );
    expect(out).toContain('aria-label="Actions for acme/site"');
    expect(out).toContain('aria-expanded="false"');
    expect(out).not.toContain('Turn checks off');
  });

  it('is named for the host when the site was added by hand', () => {
    expect(
      htmlAt(
        <SiteActions
          repo={null}
          site={{ id: 'a', host: 'x.test' }}
          paused={false}
          control={{ canManage: true, fileOff: false }}
        />,
      ),
    ).toContain('aria-label="Actions for x.test"');
  });
});
