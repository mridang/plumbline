import { describe, expect, it } from '@jest/globals';

import { Dot } from '@/components/ui-app/status-dot';
import { html } from '../render';

describe('Dot', () => {
  it('has the colour of its tone and is hidden from screen readers', () => {
    const out = html(<Dot tone="bad" />);
    expect(out).toContain('bg-failed');
    expect(out).toContain('aria-hidden="true"');
  });

  it('pulses only when asked, and only for people who accept motion', () => {
    expect(html(<Dot tone="info" pulse />)).toContain(
      'motion-safe:animate-pulse',
    );
    expect(html(<Dot tone="info" />)).not.toContain('animate-pulse');
  });

  it('comes in three sizes, the middle one by default', () => {
    expect(html(<Dot tone="good" />)).toContain('size-2.5');
    expect(html(<Dot tone="good" size="sm" />)).toContain('size-2');
    expect(html(<Dot tone="good" size="xs" />)).toContain('size-1.5');
    expect(html(<Dot tone="good" size="xs" />)).not.toContain('size-2.5');
  });
});
