import { describe, expect, it } from '@jest/globals';

import { OTHER_FLOWS, afterSignIn } from '@/domain/auth/hooks';
import { double } from '../../helpers/double';
import type { User } from '@/domain/db/users';

describe('afterSignIn', () => {
  it('has nothing more to do once the person is recorded', async () => {
    await expect(afterSignIn(double<User>({ id: 7 }))).resolves.toBeUndefined();
  });
});

describe('OTHER_FLOWS', () => {
  it('has none: signing in is the only ask', () => {
    expect(OTHER_FLOWS).toEqual({});
  });
});
