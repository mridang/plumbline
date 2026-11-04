import { describe, expect, it } from '@jest/globals';

import Home from '@/app/(site)/page';
import { SKILL_INSTALL } from '@/components/landing/ways-in';
import { CHECKS, SECTIONS } from '@/domain/checks/catalogue';
import { html } from '../../components/render';

describe('Home', () => {
  const out = html(<Home />);

  it('offers the scanner', () => {
    expect(out).toContain('role="search"');
  });

  it('counts every check', () => {
    expect(out).toContain(`${CHECKS.length} checks`);
  });

  it('shows every section that has checks', () => {
    for (const section of SECTIONS.filter((s) =>
      CHECKS.some((check) => check.section === s.id),
    )) {
      expect(out).toContain(section.title.replace('&', '&amp;'));
    }
  });

  it('shows how to install the agent skill', () => {
    expect(out).toContain(SKILL_INSTALL);
  });

  it('ends with the call to keep domains', () => {
    expect(out).toContain('Start keeping domains');
  });
});
