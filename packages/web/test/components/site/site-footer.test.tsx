import { describe, expect, it } from '@jest/globals';

import { SiteFooter } from '@/components/site/site-footer';
import { html } from '../render';

describe('SiteFooter', () => {
  it('credits webhint and points to the Docker image for the full scan', () => {
    const out = html(<SiteFooter />);
    expect(out).toContain('href="https://webhint.io"');
    expect(out).toContain(
      'href="https://github.com/mridang/webhint-hints/tree/master/packages/docker"',
    );
  });
});
