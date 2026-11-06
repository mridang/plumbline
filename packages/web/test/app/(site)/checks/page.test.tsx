import { describe, expect, it } from '@jest/globals';

import ChecksPage, { metadata } from '@/app/(site)/checks/page';
import { SECTIONS, CHECKS } from '@/domain/checks/catalogue';
import { findRuleSet } from '@/domain/checks/sets';
import { formatCount } from '@/lib/intl';
import { htmlAt } from '../../../components/render';

describe('the rules overview', () => {
  const out = htmlAt(<ChecksPage />, { pathname: '/checks' });

  it('may be indexed', () => {
    expect(metadata.title).toBe('Rules');
    expect(metadata.alternates?.canonical).toContain('/checks');
  });

  it('features the default set with its size and how to use it', () => {
    const size = findRuleSet('plumbline:recommended')!.members.length;
    expect(out).toContain('plumbline:recommended');
    expect(out).toContain(formatCount(size));
    expect(out).toContain('extends: plumbline:recommended');
    expect(out).toContain(`See the ${formatCount(size)} recommended rules`);
  });

  it('lists the other sets, the add-ons and the three steps', () => {
    for (const id of ['advanced', 'experimental', 'all']) {
      expect(out).toContain(`href="/checks/sets/${id}"`);
    }
    for (const section of SECTIONS.filter((s) => !s.default_on)) {
      expect(out).toContain(`plumbline:${section.id}/recommended`);
    }
    expect(out).toContain('Pick a rule set');
    expect(out).toContain('Tune single rules');
  });

  it('links every area', () => {
    for (const section of SECTIONS) {
      expect(out).toContain(`href="/checks/areas/${section.id}"`);
    }
    expect(out).toContain(
      `>${CHECKS.filter((c) => c.section === 'seo').length}<`,
    );
  });

  it('puts the sidebar around the page, with the areas folded and no profile for a platform', () => {
    expect(out).toContain('Rules by area');
    expect(out).toContain('Add-ons and audiences');
    expect(out).toContain('aria-current="page"');
    expect(out.toLowerCase()).not.toContain('profile/vercel');
    expect(out.toLowerCase()).not.toContain('profile/cloudflare');
  });
});
