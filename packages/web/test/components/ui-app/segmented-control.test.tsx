import { describe, expect, it } from '@jest/globals';

import {
  SegmentedControl,
  SegmentedLinks,
} from '@/components/ui-app/segmented-control';
import { html } from '../render';

const OPTIONS = [
  { value: 'problems', label: 'Problems', count: 47 },
  { value: 'failed', label: 'Failed', count: 15 },
  { value: 'all', label: 'All' },
];

describe('SegmentedControl', () => {
  const out = html(
    <SegmentedControl
      label="Show"
      options={OPTIONS}
      value="failed"
      onChange={() => undefined}
    />,
  );

  it('is a labelled group of buttons with the one in force pressed', () => {
    expect(out).toContain('role="group"');
    expect(out).toContain('aria-label="Show"');
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(out.match(/aria-pressed="false"/g)).toHaveLength(2);
  });

  it('lifts the pressed choice off the track', () => {
    expect(out).toMatch(/aria-pressed="true"[^>]*class="[^"]*bg-surface/);
    expect(out).toMatch(/aria-pressed="false"[^>]*class="[^"]*text-muted/);
  });

  it('draws the count after the label when there is one', () => {
    expect(out).toContain('Problems<span');
    expect(out).toContain('>47<');
    expect(out).toMatch(/>All<\/button>/);
  });

  it('is never a submit button', () => {
    expect(out).not.toContain('type="submit"');
    expect(out.match(/type="button"/g)).toHaveLength(3);
  });
});

describe('SegmentedLinks', () => {
  const links = html(
    <SegmentedLinks
      label="View"
      value="cards"
      options={[
        { value: 'table', label: 'Table', href: '/dashboard' },
        { value: 'cards', label: 'Cards', href: '/dashboard?view=cards' },
      ]}
    />,
  );

  it('is a labelled nav of links, the one in force marked current', () => {
    expect(links).toContain('<nav');
    expect(links).toContain('aria-label="View"');
    expect(links).toContain('href="/dashboard"');
    expect(links.match(/aria-current="true"/g)).toHaveLength(1);
    expect(links).toMatch(
      /aria-current="true"[^>]*href="\/dashboard\?view=cards"|href="\/dashboard\?view=cards"[^>]*aria-current="true"/,
    );
  });

  it('shares the look of the buttons', () => {
    expect(links).toContain('bg-surface');
    expect(links).toContain('h-8');
  });
});
