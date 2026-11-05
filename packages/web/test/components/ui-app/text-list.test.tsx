import { describe, expect, it } from '@jest/globals';

import { TextList } from '@/components/ui-app/text-list';
import { html } from '../render';

describe('TextList', () => {
  it('joins with "and"', () => {
    expect(html(<TextList items={['a', 'b', 'c']} />)).toBe('a, b, and c');
  });

  it('joins with "or" when asked', () => {
    expect(html(<TextList items={['a', 'b']} or />)).toBe('a or b');
  });

  it('is empty for no items', () => {
    expect(html(<TextList items={[]} />)).toBe('');
  });
});
