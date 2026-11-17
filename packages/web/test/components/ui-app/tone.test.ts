import { describe, expect, it } from '@jest/globals';

import { TONE_FILL, TONE_SOLID, TONE_TEXT } from '@/components/ui-app/tone';

/** Matches a text colour class prefix. */
const TEXT_CLASS_PREFIX = /^text-/u;
/** Matches background and text colour classes. */
const FILL_CLASSES = /bg-.* text-/u;
/** Matches a background colour class prefix. */
const BG_CLASS_PREFIX = /^bg-/u;

const TONES = ['neutral', 'good', 'warn', 'bad', 'info'] as const;

describe('tones', () => {
  it.each(TONES)('draw %s as text, as a soft fill and as a solid', (tone) => {
    expect(TONE_TEXT[tone]).toMatch(TEXT_CLASS_PREFIX);
    expect(TONE_FILL[tone]).toMatch(FILL_CLASSES);
    expect(TONE_SOLID[tone]).toMatch(BG_CLASS_PREFIX);
  });

  it('use the colour of the outcome they stand for', () => {
    expect(TONE_TEXT.bad).toBe('text-failed');
    expect(TONE_TEXT.warn).toBe('text-warned');
    expect(TONE_TEXT.good).toBe('text-passed');
  });
});
