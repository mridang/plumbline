import type { ReactElement } from 'react';

import { Container } from '@/components/ui/layout';

/** The look of the call's two links. */
const PRIMARY =
  'focus-ring inline-flex h-12 items-center rounded-control bg-on-night px-6 font-semibold text-night transition hover:bg-on-night/90';
const SECONDARY =
  'focus-ring inline-flex h-12 items-center rounded-control border border-on-night/25 px-6 font-semibold text-on-night transition hover:border-on-night/60';

/**
 * The closing call: keep domains, choose their checks and keep their reports
 * (the domains page asks a signed-out visitor to sign in first), or go back up
 * and scan one now. It is the same for everyone, so the page can be cached.
 */
export function FinalCta(): ReactElement {
  return (
    <section
      aria-labelledby="cta-heading"
      className="px-4 py-24 sm:px-6 lg:px-10"
    >
      <Container className="relative max-w-6xl overflow-hidden rounded-3xl bg-night px-6 py-16 text-center text-on-night sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_100%,color-mix(in_srgb,var(--color-glow)_40%,transparent),transparent)]"
        />
        <div className="relative">
          <h2
            id="cta-heading"
            className="font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl"
          >
            Keep watch over your domains
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-on-night/75">
            Sign in to keep your domains, choose the checks that matter for
            each, and keep every report to compare.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="/domains" className={PRIMARY}>
              Start keeping domains
            </a>
            <a href="#scan" className={SECONDARY}>
              Scan a page now
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
