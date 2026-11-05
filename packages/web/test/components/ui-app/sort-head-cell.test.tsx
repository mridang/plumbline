import { describe, expect, it } from '@jest/globals';

import { SortHeadCell } from '@/components/ui-app/sort-head-cell';
import { html } from '../render';

const cell = (direction: 'ascending' | 'descending' | null, align?: 'end') =>
  html(
    <table>
      <thead>
        <tr>
          <SortHeadCell
            direction={direction}
            onSort={() => undefined}
            align={align}
          >
            Status
          </SortHeadCell>
        </tr>
      </thead>
    </table>,
  );

describe('SortHeadCell', () => {
  it('is a column heading with a button that sorts by it', () => {
    const out = cell(null);
    expect(out).toContain('scope="col"');
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>Status/);
  });

  it('says how the column is sorted with aria-sort', () => {
    expect(cell('ascending')).toContain('aria-sort="ascending"');
    expect(cell('descending')).toContain('aria-sort="descending"');
    expect(cell(null)).toContain('aria-sort="none"');
  });

  it('shows the arrow only for the column in force, turned for ascending', () => {
    expect(cell(null)).toContain('opacity-0');
    expect(cell('descending')).not.toContain('opacity-0');
    expect(cell('ascending')).toContain('rotate-180');
    expect(cell('descending')).not.toContain('rotate-180');
  });

  it('lines the heading up with its figures when they are on the right', () => {
    expect(cell(null, 'end')).toContain('text-right');
    expect(cell(null)).toContain('text-left');
  });
});
