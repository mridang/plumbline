import { describe, expect, it, jest } from '@jest/globals';

import { afterAccountDeleted } from '@/domain/account/app';
import type { User } from '@/domain/db/users';

const person = { id: 7, email: 'someone@example.com' } as User;

describe('afterAccountDeleted', () => {
  it('has nothing more to do, and asks nobody', () => {
    const fetched = jest.spyOn(globalThis, 'fetch');
    expect(afterAccountDeleted(person)).toBeUndefined();
    expect(fetched).not.toHaveBeenCalled();
    fetched.mockRestore();
  });
});
