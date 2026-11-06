import { describe, expect, it } from '@jest/globals';

import WebhintPage from '@/app/(site)/checks/webhint/page';
import { STOCK_HINTS } from '@/domain/checks/stock';
import { htmlAt } from '../../../../components/render';

describe('the webhint page', () => {
  const out = htmlAt(<WebhintPage />, { pathname: '/checks/webhint' });

  it('lists every stock hint with its coverage and the rules that cover it', () => {
    for (const hint of STOCK_HINTS) {
      expect(out).toContain(hint.id);
    }
    expect(out).toContain('covered');
    expect(out).toContain('not covered');
    const covered = STOCK_HINTS.find((h) => h.coveredBy.length > 0)!;
    expect(out).toContain(`>${covered.coveredBy[0]}</a>`);
  });

  it('scrolls its table inside its own box', () => {
    expect(out).toContain('overflow-x-auto');
  });
});
