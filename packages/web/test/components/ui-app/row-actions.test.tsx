import { describe, expect, it } from '@jest/globals';

import { RowActions } from '@/components/ui-app/row-actions';
import { htmlAt } from '../render';

describe('RowActions', () => {
  const out = htmlAt(
    <RowActions label="acme/site">
      <a href="/x">Open</a>
    </RowActions>,
  );

  it('is a "more" button named for its row, so it is not just "Actions"', () => {
    expect(out).toContain('aria-label="Actions for acme/site"');
    expect(out).toContain('<circle');
  });

  it('keeps its actions out of the page until it is opened', () => {
    expect(out).toContain('aria-expanded="false"');
    expect(out).not.toContain('href="/x"');
  });
});
