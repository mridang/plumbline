import { describe, expect, it } from '@jest/globals';

import { firstNameOf } from '@/components/site/first-name';

describe('firstNameOf', () => {
  it('takes the first word of the name', () => {
    expect(firstNameOf({ name: 'Ada Lovelace', email: 'a@b.com' })).toBe('Ada');
    expect(firstNameOf({ name: '  Ada  ', email: 'a@b.com' })).toBe('Ada');
  });

  it('falls back to the part of the email before the @', () => {
    expect(firstNameOf({ name: null, email: 'ada@example.com' })).toBe('ada');
    expect(firstNameOf({ name: ' '.repeat(3), email: 'ada@example.com' })).toBe(
      'ada',
    );
  });
});
