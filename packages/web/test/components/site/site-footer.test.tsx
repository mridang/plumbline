import { describe, expect, it } from '@jest/globals';

import { FOOTER_COLUMNS, SiteFooter } from '@/components/site/site-footer';
import { html } from '../render';

describe('SiteFooter', () => {
  const out = html(<SiteFooter />);

  it('credits webhint', () => {
    expect(out).toContain('href="https://webhint.io"');
  });

  it('carries the small print with the licence', () => {
    expect(out).toContain('Open source under the Apache 2.0 licence.');
  });

  it.each(FOOTER_COLUMNS.map((column) => [column.title]))(
    'heads the %s column',
    (title) => {
      expect(out).toContain(`>${title}</h2>`);
    },
  );

  it('links every entry of every column', () => {
    for (const link of FOOTER_COLUMNS.flatMap((column) => column.links)) {
      expect(out).toContain(`href="${link.href}"`);
    }
  });

  it('points to each way to run the checks', () => {
    for (const pkg of ['cli', 'hints', 'lighthouse', 'docker']) {
      expect(out).toContain(
        `href="https://github.com/mridang/webhint-hints/tree/master/packages/${pkg}"`,
      );
    }
  });

  it('links only pages anyone can open, or documentation', () => {
    const hrefs = FOOTER_COLUMNS.flatMap((column) =>
      column.links.map((link) => link.href),
    );
    expect(hrefs).not.toContain('/api/sessions');
  });
});
