import { describe, expect, it } from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET } from '@/app/api/github/callback/route';

describe('GET /api/github/callback (the address the GitHub App still has registered)', () => {
  it('sends the browser on to the callback that replaced it, with the query kept', () => {
    const response = GET(
      new NextRequest(
        'https://plumbline.test/api/github/callback?code=c1&state=github.abc',
      ),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://plumbline.test/auth/github/link/callback?code=c1&state=github.abc',
    );
  });
});
