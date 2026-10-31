import { describe, expect, it } from '@jest/globals';

import { ThemeScript } from '@/components/site/theme-script';

describe('ThemeScript', () => {
  it('writes nothing: the page has one light theme', () => {
    expect(ThemeScript()).toBeNull();
  });
});
