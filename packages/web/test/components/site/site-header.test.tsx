import { describe, expect, it } from '@jest/globals';

import { SiteHeader } from '@/components/site/site-header';
import { html } from '../render';

describe('SiteHeader', () => {
  it('shows the logo and links to the source', () => {
    const out = html(<SiteHeader />);
    expect(out).toContain('plumbline</a>');
    expect(out).toContain('href="https://github.com/mridang/webhint-hints"');
  });

  it('offers no install button until the browser offers one', () => {
    expect(html(<SiteHeader />)).not.toContain('Install app');
  });
});
