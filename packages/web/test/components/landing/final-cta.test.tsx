import { describe, expect, it } from '@jest/globals';

import { FinalCta } from '@/components/landing/final-cta';
import { html } from '../render';

describe('FinalCta', () => {
  const out = html(<FinalCta />);

  it('leads to keeping domains, which asks a visitor to sign in first', () => {
    expect(out).toMatch(/href="\/domains"[^>]*>Start keeping domains<\/a>/);
  });

  it('leads back up to the scanner', () => {
    expect(out).toMatch(/href="#scan"[^>]*>Scan a page now<\/a>/);
  });
});
