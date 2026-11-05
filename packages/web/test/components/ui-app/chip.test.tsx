import { describe, expect, it } from '@jest/globals';

import { Chip } from '@/components/ui-app/chip';
import { html } from '../render';

describe('Chip', () => {
  it('shows its text as a small rounded label', () => {
    const out = html(<Chip>Manual</Chip>);
    expect(out).toContain('>Manual</span>');
    expect(out).toContain('rounded-full');
  });

  it('is drawn in the colour of its tone', () => {
    expect(html(<Chip tone="bad">x</Chip>)).toContain('text-failed');
    expect(html(<Chip tone="good">x</Chip>)).toContain('text-passed');
    expect(html(<Chip tone="info">x</Chip>)).toContain('text-accent');
  });

  it('has a larger size', () => {
    expect(html(<Chip size="md">x</Chip>)).toContain('text-sm');
    expect(html(<Chip>x</Chip>)).toContain('text-xs');
  });

  it('can be set in the monospace face and carry a tooltip', () => {
    const out = html(
      <Chip mono title="the full id">
        abc1234
      </Chip>,
    );
    expect(out).toContain('font-mono');
    expect(out).toContain('title="the full id"');
  });
});
