import { describe, expect, it } from '@jest/globals';

import { SiteShell } from '@/components/site/shell';
import { html } from '../render';

describe('SiteShell', () => {
  it('puts the skip link first, then the header, the page in main, and the footer', () => {
    const out = html(
      <SiteShell>
        <p>page</p>
      </SiteShell>,
    );
    const order = [
      'href="#main"',
      '<header',
      '<main id="main"',
      '<p>page</p>',
      '<footer',
    ].map((marker) => out.indexOf(marker));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
