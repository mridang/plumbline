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

/**
 * A soft fill, its text colour and a hairline ring of the same colour, for a
 * badge: the tint is light enough that the text keeps 4.5:1 on it, and the ring
 * keeps the edge visible on paper and on white.
 */
export const TONE_FILL: Readonly<Record<Tone, string>> = {
  neutral: 'bg-ink/6 text-ink ring-ink/15',
  good: 'bg-passed/10 text-passed ring-passed/25',
  warn: 'bg-warned/10 text-warned ring-warned/25',
  bad: 'bg-failed/10 text-failed ring-failed/25',
  info: 'bg-accent/10 text-accent ring-accent/25',
};

/** The solid colour of each tone, for a dot or an edge. */
export const TONE_SOLID: Readonly<Record<Tone, string>> = {
  neutral: 'bg-subtle',
  good: 'bg-passed',
  warn: 'bg-warned',
  bad: 'bg-failed',
  info: 'bg-accent',
};
