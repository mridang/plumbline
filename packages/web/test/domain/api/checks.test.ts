import { describe, expect, it } from '@jest/globals';

import { createChecksCollection } from '@/domain/api/checks';
import { CHECKS, checksInGroup } from '@/domain/checks/catalogue';

const { GET } = createChecksCollection().handlers();

/** A GET of the list with the given query. */
const list = (query = '') =>
  GET(new Request(`https://plumbline.test/api/checks${query}`));

/** The ids on a page. */
async function idsOf(res: Response): Promise<string[]> {
  const body = (await res.json()) as { items: { id: string }[] };
  return body.items.map((check) => check.id);
}

describe('GET /api/checks', () => {
  it('lists the first page of checks, sorted by id', async () => {
    expect(await idsOf(await list())).toEqual(
      CHECKS.slice(0, 20).map((check) => check.id),
    );
  });

  it('may be cached, since it is the same for everyone', async () => {
    const res = await list();
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
  });

  it('lists only the checks of a group', async () => {
    expect(await idsOf(await list('?group=email&limit=100'))).toEqual(
      checksInGroup('email').map((check) => check.id),
    );
  });

  it('carries on from where the last page stopped', async () => {
    const page = await list('?limit=2');
    const first = (await page.json()) as { next: string };
    expect(await idsOf(await list(new URL(first.next).search))).toEqual(
      CHECKS.slice(2, 4).map((check) => check.id),
    );
  });

  it.each([
    ['a group that does not exist', '?group=nope'],
    ['a limit out of range', '?limit=-1'],
    ['a cursor it did not hand out', '?cursor=nope'],
  ])('answers 400 for %s', async (_case, query) => {
    const res = await list(query);
    expect(res.status).toBe(400);
  });
});
