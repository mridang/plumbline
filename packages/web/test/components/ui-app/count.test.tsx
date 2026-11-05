import { describe, expect, it } from '@jest/globals';

import { Count } from '@/components/ui-app/count';
import { html } from '../render';

describe('Count', () => {
  it('groups thousands and keeps digits aligned', () => {
    const out = html(<Count value={1234567} />);
    expect(out).toContain('>1,234,567</span>');
    expect(out).toContain('tabular-nums');
  });

  it('can be shortened, keeping the whole number as its tooltip', () => {
    const out = html(<Count value={1234} compact />);
    expect(out).toContain('>1.2K</span>');
    expect(out).toContain('title="1,234"');
  });
});
