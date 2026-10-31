import type { ReactElement } from 'react';

import { Container, Eyebrow, Heading } from '@/components/ui/layout';

import { BRAND_TAGLINE } from '@/app/_brand';
import { Scanner } from './_components/scanner';

/**
 * The one page: a box to type a domain into, and the checks it comes back
 * with. The checks run in the visitor's browser (see `domain/scan`), so this
 * page is the same for everyone and can be cached.
 */
export default function Home(): ReactElement {
  return (
    <Container className="max-w-4xl py-12 sm:py-16">
      <Eyebrow>{BRAND_TAGLINE}</Eyebrow>
      <Heading as="h1" variant="h1" className="mt-3">
        How does your site hold up?
      </Heading>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Type a domain and get every check this project ships: security headers,
        TLS, DNS and email, privacy, SEO, social cards and agent readiness. The
        checks run in your browser, so the few that need raw connections or
        script in the page are marked as skipped.
      </p>
      <Scanner />
    </Container>
  );
}
