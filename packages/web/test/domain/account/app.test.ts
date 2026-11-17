import { describe, expect, it, jest } from '@jest/globals';

import { afterAccountDeleted } from '@/domain/account/app';
import type { User } from '@/domain/db/users';
import { double } from '../../helpers/double';

const person = double<User>({ id: 7, email: 'someone@example.com' });

describe('afterAccountDeleted', () => {
  it('has nothing more to do, and asks nobody', () => {
    const fetched = jest.spyOn(globalThis, 'fetch');
    afterAccountDeleted(person);
    expect(fetched).not.toHaveBeenCalled();
    fetched.mockRestore();
  });
});
