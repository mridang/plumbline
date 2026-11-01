import type { ReactElement } from 'react';

import { Scanner } from '@/components/scan/scanner';
import { Container } from '@/components/ui/layout';

import { RULE_SOURCES } from './sources';

/**
 * The top of the home page: a deep band with what plumbline does, and the
 * scanner on a raised card that overlaps the band's lower edge, so the first
 * thing on the page is the box to type a domain into. A scan's results open
 * inside the card.
 */
export function Hero({
  checks,
}: Readonly<{
  /** How many checks there are, for the line above the heading. */
  checks: number;
}>): ReactElement {
  return (
    <>
      <section
        aria-labelledby="hero"
        className="relative overflow-hidden bg-night text-on-night"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_srgb,var(--color-glow)_45%,transparent),transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-on-night)_6%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--color-on-night)_6%,transparent)_1px,transparent_1px)] mask-[radial-gradient(70%_70%_at_50%_30%,black,transparent)] bg-size-[48px_48px]"
        />
        <Container className="relative max-w-5xl pt-20 pb-44 text-center sm:pt-28">
          <p className="inline-flex items-center gap-2 rounded-full border border-on-night/15 bg-on-night/5 px-4 py-1.5 text-sm text-on-night/80">
            <span
              className="size-1.5 rounded-full bg-glow"
              aria-hidden="true"
            />
            Open source · {checks} checks · free to use
          </p>
          <h1
            id="hero"
            className="mt-6 font-display text-4xl leading-[1.08] font-semibold tracking-tight sm:text-6xl"
          >
            Find what your website gets wrong,{' '}
            <span className="bg-linear-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
              and how to fix it
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-on-night/75">
            Plumbline checks security headers, TLS, DNS and email, privacy, SEO,
            social cards and AI-agent readiness against the rules of the public
            references, and shows the evidence and the fix for every failure.
          </p>
        </Container>
      </section>
      <Container className="relative -mt-32 max-w-5xl">
        <div
          id="scan"
          className="scroll-mt-24 rounded-2xl bg-surface p-5 shadow-[0_24px_60px_-20px_rgb(11_10_31/0.35)] ring-1 ring-ink/5 sm:p-8"
        >
          <p className="text-sm font-semibold">Scan a page</p>
          <p className="mt-1 text-sm text-subtle">
            Free, no sign-up. The checks run in your browser; a page can be
            checked once every five minutes.
          </p>
          <Scanner className="mt-5" />
        </div>
        <div className="mt-12 text-center">
          <p className="text-label font-semibold text-subtle uppercase">
            Rules ported from
          </p>
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-base font-semibold text-ink/60">
            {RULE_SOURCES.map((source) => (
              <li key={source.name}>
                <a
                  href={source.url}
                  className="focus-ring transition hover:text-ink"
                >
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </>
  );
}
