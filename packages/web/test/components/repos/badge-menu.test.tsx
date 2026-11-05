import { describe, expect, it } from '@jest/globals';

import { BadgeMenu } from '@/components/repos/badge-menu';
import { htmlAt } from '../render';

describe('BadgeMenu', () => {
  const out = htmlAt(
    <BadgeMenu
      repo="acme/site"
      image="/badge/acme/site/abc.svg"
      markdown="[![Plumbline](https://x/badge.svg)](https://x/repos/acme/site)"
    />,
  );

  it('is a small Badge button and nothing else until it is opened', () => {
    expect(out).toContain('>Badge<');
    expect(out).toContain('aria-expanded="false"');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('README badge');
  });
});
