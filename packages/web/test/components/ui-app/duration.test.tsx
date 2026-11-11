import { describe, expect, it } from '@jest/globals';

import { Duration } from '@/components/ui-app/duration';
import { html } from '../render';

describe('Duration', () => {
  it('writes seconds with one decimal under a minute', () => {
    expect(html(<Duration ms={21_140} />)).toContain(
      '>21.1s<span class="sr-only">',
    );
  });

  it('writes minutes and seconds from a minute up', () => {
    expect(html(<Duration ms={65_000} />)).toContain(
      '>1m 5s<span class="sr-only">',
    );
  });

  it('keeps the exact milliseconds for people who hear the page', () => {
    expect(html(<Duration ms={21_140} />)).toContain(
      '<span class="sr-only"> (21140 milliseconds)</span>',
    );
  });
});
