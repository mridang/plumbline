import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { POST } from '@/app/api/scans/[id]/fetches/route';
import { issueScanId } from '@/domain/scan/token';
import { installCloudflareContext } from '../../../../../lib/core/db/sqlite-d1';

let restore: () => void;

beforeEach(() => {
  restore = installCloudflareContext({} as D1Database, {
    SCAN_SECRET: 'route-secret',
  });
});

afterEach(() => {
  restore();
  jest.restoreAllMocks();
});

describe('POST /api/scans/{id}/fetches', () => {
  it('fetches the target for a scan the app signed', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('User-agent: *'));
    const { id } = await issueScanId('https://example.com/', 'route-secret');
    const response = await POST(
      new Request(`https://app.test/api/scans/${id}/fetches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/robots.txt' }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('User-agent: *');
  });
});
