import Link from 'next/link';
import type { ReactElement } from 'react';

import { Container, Eyebrow, Heading } from '@/components/ui/layout';

import { BRAND_TAGLINE } from '@/app/_brand';
import { Scanner } from '@/components/scan/scanner';

import { AgentSkill } from './_components/agent-skill';

/**
 * The front page: a box to type a domain into, and the checks it comes back
 * with. The checks run in the visitor's browser (see `domain/scan`), and
 * nothing about the scan is stored. Below it, how to install the agent skill.
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
        script in the page are marked as skipped.{' '}
        <Link href="/domains" className="focus-ring text-accent underline">
          Sign in
        </Link>{' '}
        to keep your domains, choose their checks and save their reports.
      </p>
      <Scanner />
      <AgentSkill />
    </Container>
  );
}
