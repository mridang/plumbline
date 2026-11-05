import { describe, expect, it } from '@jest/globals';

import { TONE_FILL, TONE_SOLID, TONE_TEXT } from '@/components/ui-app/tone';

const TONES = ['neutral', 'good', 'warn', 'bad', 'info'] as const;

describe('tones', () => {
  it.each(TONES)('draw %s as text, as a soft fill and as a solid', (tone) => {
    expect(TONE_TEXT[tone]).toMatch(/^text-/);
    expect(TONE_FILL[tone]).toMatch(/bg-.* text-/);
    expect(TONE_SOLID[tone]).toMatch(/^bg-/);
  });

  it('use the colour of the outcome they stand for', () => {
    expect(TONE_TEXT.bad).toBe('text-failed');
    expect(TONE_TEXT.warn).toBe('text-warned');
    expect(TONE_TEXT.good).toBe('text-passed');
  });
});
