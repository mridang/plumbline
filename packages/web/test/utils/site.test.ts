import { describe, expect, it } from '@jest/globals';

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  SOURCE_URL,
} from '@/utils/site';

describe('site identity', () => {
  it('gives the site an https address with no trailing slash', () => {
    expect(SITE_URL).toMatch(/^https:\/\/[^/]+$/);
  });

  it('names the site in its address', () => {
    expect(new URL(SITE_URL).hostname.startsWith(`${SITE_NAME}.`)).toBe(true);
  });

  it('gives the site a default title and description', () => {
    expect(SITE_TITLE).not.toBe('');
    expect(SITE_DESCRIPTION).not.toBe('');
  });

  it('points to the source on GitHub', () => {
    expect(SOURCE_URL).toBe('https://github.com/mridang/webhint-hints');
  });
});
