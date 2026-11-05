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
});
