import { describe, expect, it } from '@jest/globals';

import { POST as old } from '@/app/api/github/webhook/route';
import { POST } from '@/app/webhooks/github/route';

describe('POST /api/github/webhook (the address the GitHub App still has registered)', () => {
  it('is the same handler as the webhook that replaced it', () => {
    expect(old).toBe(POST);
  });
});
