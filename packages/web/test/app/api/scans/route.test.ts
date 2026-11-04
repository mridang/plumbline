import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { POST } from '@/app/api/scans/route';
import { installCloudflareContext } from '../../../lib/core/db/sqlite-d1';

let restore: () => void;

beforeEach(() => {
  restore = installCloudflareContext({} as D1Database, {
    SCAN_SECRET: 'route-secret',
  });
});

afterEach(() => restore());

describe('POST /api/scans', () => {
  it('starts a scan signed with the app secret', async () => {
    const response = await POST(
      new Request('https://app.test/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'example.com' }),
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      url: 'https://example.com/',
    });
  });
});
