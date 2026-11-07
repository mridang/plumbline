import { describe, expect, it } from '@jest/globals';

import { FilterChip } from '@/components/ui-app/filter-chip';
import { htmlAt } from '../render';

describe('FilterChip', () => {
  it('is a button that says whether it is on', () => {
    const on = htmlAt(
      <FilterChip label="Failing" count={2} pressed onPress={() => {}} />,
    );
    expect(on).toContain('<button');
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain('Failing');
    expect(
      htmlAt(
        <FilterChip
          label="Failing"
          count={2}
          pressed={false}
          onPress={() => {}}
        />,
      ),
    ).toContain('aria-pressed="false"');
  });

  it('mutes a count of zero and keeps the chip', () => {
    const zero = htmlAt(
      <FilterChip
        label="Failing"
        count={0}
        pressed={false}
        onPress={() => {}}
      />,
    );
    expect(zero).toContain('text-subtle');
    expect(zero).toContain('Failing');
  });
});
