import { describe, expect, it } from '@jest/globals';

import { RULE_SOURCES } from '@/components/landing/sources';

describe('RULE_SOURCES', () => {
  it('names each reference once, with an https address', () => {
    expect(new Set(RULE_SOURCES.map((s) => s.name)).size).toBe(
      RULE_SOURCES.length,
    );
    for (const source of RULE_SOURCES) {
      expect(source.url).toMatch(/^https:\/\//);
    }
  });
});
