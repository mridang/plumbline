import { describe, expect, it } from '@jest/globals';

import { ToggleChip } from '@/components/ui-app/toggle-chip';
import { html } from '../render';

describe('ToggleChip', () => {
  it('says whether it is on, and is filled when it is', () => {
    const on = html(
      <ToggleChip pressed onClick={() => undefined}>
        Problems
      </ToggleChip>,
    );
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain('bg-ink');
    expect(
      html(
        <ToggleChip pressed={false} onClick={() => undefined}>
          Problems
        </ToggleChip>,
      ),
    ).toContain('aria-pressed="false"');
  });

  it('can carry a count after its label', () => {
    expect(
      html(
        <ToggleChip pressed={false} onClick={() => undefined} count={12}>
          All
        </ToggleChip>,
      ),
    ).toContain('>12</span>');
  });
});
