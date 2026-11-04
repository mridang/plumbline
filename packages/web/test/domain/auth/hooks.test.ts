import { describe, expect, it } from '@jest/globals';

import { OTHER_FLOWS, afterSignIn } from '@/domain/auth/hooks';
import type { User } from '@/domain/db/users';

describe('afterSignIn', () => {
  it('has nothing more to do once the person is recorded', async () => {
    await expect(afterSignIn({ id: 7 } as User)).resolves.toBeUndefined();
  });
});

describe('OTHER_FLOWS', () => {
  it('has none: signing in is the only ask', () => {
    expect(OTHER_FLOWS).toEqual({});
  });
});
