/**
 * @packageDocumentation
 *
 * The tones the app's small parts are drawn in, one set of words for all of
 * them: a chip, a count, a status line and a card's edge say "good", "warn"
 * or "bad" the same way, from the same colours.
 */

/** What a part says about what it shows. */
export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

/** The text colour of each tone. */
export const TONE_TEXT: Readonly<Record<Tone, string>> = {
  neutral: 'text-muted',
  good: 'text-passed',
  warn: 'text-warned',
  bad: 'text-failed',
  info: 'text-accent',
};

/** A soft fill and its text colour, for a chip. */
export const TONE_FILL: Readonly<Record<Tone, string>> = {
  neutral: 'bg-ink/8 text-ink',
  good: 'bg-passed/10 text-passed',
  warn: 'bg-warned/12 text-warned',
  bad: 'bg-failed/10 text-failed',
  info: 'bg-accent/10 text-accent',
};

/** The solid colour of each tone, for a dot or an edge. */
export const TONE_SOLID: Readonly<Record<Tone, string>> = {
  neutral: 'bg-subtle',
  good: 'bg-passed',
  warn: 'bg-warned',
  bad: 'bg-failed',
  info: 'bg-accent',
};
