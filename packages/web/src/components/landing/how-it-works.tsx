import type { ReactElement } from 'react';

import { Container, Eyebrow } from '@/components/ui/layout';

/** One step of a scan, as the home page tells it. */
interface Step {
  readonly title: string;
  readonly body: string;
}

/** What happens between typing a domain and reading the report. */
export const STEPS: readonly Step[] = [
  {
    title: 'Type a domain',
    body: 'Any public page. The address is cleaned up first, so the same page written two ways is scanned once.',
  },
  {
    title: 'The checks run on our server',
    body: 'Every check runs on Plumbline’s servers, including TLS, DNS and mail, and the results appear here as each one finishes. Nothing about a scan is stored unless you save it.',
  },
  {
    title: 'Read what to fix',
    body: 'Every failure comes with the evidence, who usually makes the fix, the rule it breaks and where the rule comes from.',
  },
];

/** How a scan works, in three steps. */
export function HowItWorks(): ReactElement {
  return (
    <section aria-labelledby="how-heading" className="py-24">
      <Container className="max-w-6xl">
        <Eyebrow>How it works</Eyebrow>
        <h2
          id="how-heading"
          className="mt-3 max-w-2xl font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl"
        >
          From a domain to a list of fixes in under a minute
        </h2>
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t-2 border-brand pt-5">
              <p className="font-mono text-sm text-brand">0{index + 1}</p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
