import { describe, expect, it } from '@jest/globals';

import { Duration } from '@/components/ui-app/duration';
import { html } from '../render';

describe('Duration', () => {
  it('writes seconds with one decimal under a minute', () => {
    expect(html(<Duration ms={21_140} />)).toContain('>21.1s</span>');
  });

  it('writes minutes and seconds from a minute up', () => {
    expect(html(<Duration ms={65_000} />)).toContain('>1m 5s</span>');
  });

  it('keeps the exact milliseconds as its tooltip', () => {
    expect(html(<Duration ms={21_140} />)).toContain(
      'title="21140 milliseconds"',
    );
  });
});
