import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { Badge } from '@/components/ui-app/badge';
import type { Tone } from '@/components/ui-app/tone';
import type { Tier } from '@/domain/checks/catalogue';

/** The tone each tier is drawn in. */
const TIER_TONE: Readonly<Record<Tier, Tone>> = {
  recommended: 'good',
  advanced: 'neutral',
  experimental: 'info',
};

/** A tier as a badge. */
export function TierBadge({ tier }: Readonly<{ tier: Tier }>): ReactElement {
  return <Badge tone={TIER_TONE[tier]}>{tier}</Badge>;
}

/** A small link to a tag or an area, in the monospace face. */
export function Chip({
  href,
  children,
}: Readonly<{ href: string; children: ReactNode }>): ReactElement {
  return (
    <Link
      href={href}
      className="focus-ring-flush inline-flex h-5 items-center rounded-full px-2 font-mono text-xs text-muted ring-1 ring-ink/10 ring-inset hover:bg-ink/6 hover:text-ink"
    >
      {children}
    </Link>
  );
}

/** Code inside a sentence. */
export function Code({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <code className="rounded bg-ink/6 px-1 py-0.5 font-mono text-[0.85em] text-ink">
      {children}
    </code>
  );
}

/** Text in which set names and file keys are set as code. */
export function Rich({ text }: Readonly<{ text: string }>): ReactElement {
  const parts = text.split(
    /(plumbline:[a-z/-]+|plumbline\.yaml|extends:|rules:|hsts: off)/g,
  );
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <Code key={`${index}:${part}`}>{part}</Code> : part,
      )}
    </>
  );
}

/** The small tracked line above a title. */
export function Kicker({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <p className="text-label font-semibold tracking-[0.16em] text-accent uppercase">
      {children}
    </p>
  );
}

/** The one heading of a rules page. */
export function PageTitle({
  children,
  extra,
}: Readonly<{ children: ReactNode; extra?: ReactNode }>): ReactElement {
  return (
    <h1 className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-[2.5rem]">
      {children}
      {extra}
    </h1>
  );
}

/** The paragraph under the title. */
export function Lead({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <p className="mt-3 max-w-2xl text-base leading-relaxed text-pretty text-muted sm:text-lg">
      {children}
    </p>
  );
}

/** The heading of a part of a rules page. */
export function PartTitle({
  title,
  sub,
}: Readonly<{ title: string; sub?: ReactNode }>): ReactElement {
  return (
    <div className="mt-14 mb-5">
      <h2 className="font-display text-xl leading-snug font-semibold tracking-tight">
        {title}
      </h2>
      {sub ? (
        <p className="mt-1 max-w-xl text-sm text-balance text-muted">{sub}</p>
      ) : null}
    </div>
  );
}

/** A small tracked label. */
export function Label({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>): ReactElement {
  return (
    <p
      className={`text-label font-semibold tracking-[0.16em] text-subtle uppercase ${className ?? ''}`}
    >
      {children}
    </p>
  );
}

/** The arrow that nudges right when its link is hovered. */
export function Arrow(): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="inline-block group-hover:translate-x-0.5 motion-safe:transition"
    >
      →
    </span>
  );
}

/** A small chevron; `className` turns it when its fold is open. */
export function Chevron({
  className,
}: Readonly<{ className?: string }>): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className={`size-3.5 shrink-0 text-subtle motion-safe:transition ${className ?? ''}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

/** The class of a ghost button. */
export const BTN_GHOST =
  'focus-ring-flush inline-flex h-8 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-muted motion-safe:transition hover:bg-ink/6 hover:text-ink';

/** The class of the main button. */
export const BTN_PRIMARY =
  'focus-ring group inline-flex h-10 items-center gap-2 rounded-control bg-ink px-4 text-sm font-medium text-on-ink motion-safe:transition hover:bg-ink/85';
