import { describe, expect, it } from '@jest/globals';

import { FinalCta } from '@/components/landing/final-cta';
import { html } from '../render';

/** Matches the open dashboard link. */
const OPEN_DASHBOARD_LINK = /href="\/dashboard"[^>]*>Open your dashboard<\/a>/;
/** Matches the scan a page link. */
const SCAN_PAGE_LINK = /href="#scan"[^>]*>Scan a page now<\/a>/;

describe('FinalCta', () => {
  const out = html(<FinalCta />);

  it('leads to the dashboard, which asks a visitor to sign in first', () => {
    expect(out).toMatch(OPEN_DASHBOARD_LINK);
  });

  it('leads back up to the scanner', () => {
    expect(out).toMatch(SCAN_PAGE_LINK);
  });
});
