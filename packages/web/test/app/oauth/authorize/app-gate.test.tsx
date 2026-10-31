import { describe, expect, it } from '@jest/globals';

import { approvalGate } from '@/app/oauth/authorize/app-gate';
import type { User } from '@/domain/auth/store';

const person = { id: 7, email: 'someone@example.com' } as User;

describe('approvalGate', () => {
  it('lets every signed-in person go on to approve', () => {
    expect(approvalGate(person, '/oauth/authorize?client_id=c')).toBeNull();
  });
});
