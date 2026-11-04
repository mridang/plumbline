import { describe, expect, it } from '@jest/globals';

import { GET } from '@/app/api/checks/route';
import { CHECKS } from '@/domain/checks/catalogue';

describe('GET /api/checks', () => {
  it('answers the first page of checks', async () => {
    const res = await GET(new Request('https://plumbline.test/api/checks'));
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items[0]?.id).toBe(CHECKS[0]?.id);
  });

  it('answers 400 for a group that does not exist', async () => {
    const res = await GET(
      new Request('https://plumbline.test/api/checks?group=nope'),
    );
    expect(res.status).toBe(400);
  });
});
