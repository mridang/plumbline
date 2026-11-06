import { describe, expect, it } from '@jest/globals';

import { isCheckId } from '@/domain/checks/catalogue';
import { STOCK_HINTS } from '@/domain/checks/stock';

describe('the stock hints', () => {
  it('have each id once, a name and a link', () => {
    const ids = STOCK_HINTS.map((hint) => hint.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const hint of STOCK_HINTS) {
      expect(hint.name).toBeTruthy();
      expect(hint.url).toMatch(/^https:\/\//);
    }
  });

  it('name only checks of the catalogue as covering them, and only when they are covered', () => {
    for (const hint of STOCK_HINTS) {
      expect(hint.coveredBy.filter((id) => !isCheckId(id))).toEqual([]);
      if (hint.status === 'not covered') {
        expect(hint.coveredBy).toEqual([]);
      } else {
        expect(hint.coveredBy.length).toBeGreaterThan(0);
      }
    }
  });
});
