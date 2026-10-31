import { describe, expect, it } from '@jest/globals';

import Home from '@/app/(site)/page';
import { BRAND_TAGLINE } from '@/app/_brand';
import { SKILL_INSTALL } from '@/app/(site)/_components/agent-skill';
import { html } from '../../components/render';

describe('Home', () => {
  const out = html(<Home />);

  it('carries the tagline', () => {
    expect(out).toContain(BRAND_TAGLINE);
  });

  it('offers the scanner', () => {
    expect(out).toContain('role="search"');
  });

  it('points to the domains, for keeping them', () => {
    expect(out).toMatch(/href="\/domains"[^>]*>Sign in<\/a>/);
  });

  it('shows how to install the agent skill', () => {
    expect(out).toContain(SKILL_INSTALL);
  });
});
