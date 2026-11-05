import { describe, expect, it } from '@jest/globals';

import { Badge } from '@/components/ui-app/badge';
import { html } from '../render';

describe('Badge', () => {
  it('shows its text as a small rounded label of a fixed height', () => {
    const out = html(<Badge>Manual</Badge>);
    expect(out).toContain('>Manual</span>');
    expect(out).toContain('rounded-full');
    expect(out).toContain('h-5');
    expect(out).toContain('text-xs');
    expect(out).toContain('font-medium');
    expect(out).toContain('tabular-nums');
  });

  it('is drawn in the colour of its tone, with a ring of the same colour', () => {
    const bad = html(<Badge tone="bad">x</Badge>);
    expect(bad).toContain('text-failed');
    expect(bad).toContain('ring-failed/25');
    expect(html(<Badge tone="good">x</Badge>)).toContain('text-passed');
    expect(html(<Badge tone="warn">x</Badge>)).toContain('text-warned');
    expect(html(<Badge tone="info">x</Badge>)).toContain('text-accent');
  });

  it('has a taller size that keeps the same type size', () => {
    const md = html(<Badge size="md">x</Badge>);
    expect(md).toContain('h-6');
    expect(md).toContain('text-xs');
  });

  it('can lead with a dot in its tone, which pulses while something goes on', () => {
    const plain = html(<Badge tone="warn">x</Badge>);
    expect(plain).not.toContain('rounded-full bg-warned');
    const dotted = html(
      <Badge tone="info" dot pulse>
        x
      </Badge>,
    );
    expect(dotted).toContain('bg-accent');
    expect(dotted).toContain('animate-pulse');
  });

  it('can be set in the monospace face and carry a tooltip', () => {
    const out = html(
      <Badge mono title="the full id">
        abc1234
      </Badge>,
    );
    expect(out).toContain('font-mono');
    expect(out).toContain('title="the full id"');
  });
});
