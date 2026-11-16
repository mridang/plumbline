import { describe, expect, it } from '@jest/globals';

import { RULE_SOURCES } from '@/components/landing/sources';

/** Matches https url prefix. */
const HTTPS_URL_PREFIX = /^https:\/\//;

describe('RULE_SOURCES', () => {
  it('names each reference once, with an https address', () => {
    expect(new Set(RULE_SOURCES.map((s) => s.name)).size).toBe(
      RULE_SOURCES.length,
    );
    for (const source of RULE_SOURCES) {
      expect(source.url).toMatch(HTTPS_URL_PREFIX);
    }
  });
});
