import type { ReactElement } from 'react';

import { Coverage } from '@/components/landing/coverage';
import { FinalCta } from '@/components/landing/final-cta';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { WaysIn } from '@/components/landing/ways-in';
import { CHECKS, SECTIONS, checksPerSection } from '@/domain/checks/catalogue';
import { jsonLdText, landingJsonLd } from '@/lib/core/seo';

/**
 * The front page: the scanner first, then what it checks, how a scan works,
 * every other way to run the checks, and a call to follow GitHub
 * repositories. The checks run on the server (see `domain/scan`), and nothing
 * about a scan is stored. The page is the same for everyone, so it can be cached.
 */
export default function Home(): ReactElement {
  const counts = checksPerSection();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdText(landingJsonLd()) }}
      />
      <Hero checks={CHECKS.length} />
      <Coverage
        areas={SECTIONS.map((section) => ({
          id: section.id,
          title: section.title,
          description: section.description,
          fixer: section.fixer,
          checks: counts.get(section.id) ?? 0,
        }))}
      />
      <HowItWorks />
      <WaysIn />
      <FinalCta />
    </>
  );
}
