import { describe, expect, it } from '@jest/globals';

import { StatusCard } from '@/components/ui-app/status-card';
import { html } from '../render';

describe('StatusCard', () => {
  it('has an edge in the colour of its tone', () => {
    const out = html(<StatusCard tone="bad">content</StatusCard>);
    expect(out).toContain('bg-failed');
    expect(out).toContain('content');
    expect(out).toContain('<article');
  });

  it('is dimmed when muted', () => {
    expect(
      html(
        <StatusCard tone="good" muted>
          x
        </StatusCard>,
      ),
    ).toContain('opacity-70');
    expect(html(<StatusCard tone="good">x</StatusCard>)).not.toContain(
      'opacity-70',
    );
  });
});
