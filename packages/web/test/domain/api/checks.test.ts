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
    expect((await list()).headers.get('cache-control')).toBe(
      'public, max-age=300',
    );
  });

  it('lists only the checks of a group', async () => {
    expect(await idsOf(await list('?group=email&limit=100'))).toEqual(
      checksInGroup('email').map((check) => check.id),
    );
  });

  it('carries on from where the last page stopped', async () => {
    const first = (await (await list('?limit=2')).json()) as { next: string };
    expect(await idsOf(await list(new URL(first.next).search))).toEqual(
      CHECKS.slice(2, 4).map((check) => check.id),
    );
  });

  it('answers 400 for a group that does not exist', async () => {
    expect((await list('?group=nope')).status).toBe(400);
  });

  it('answers 400 for a limit out of range', async () => {
    expect((await list('?limit=-1')).status).toBe(400);
  });

  it('answers 400 for a cursor it did not hand out', async () => {
    expect((await list('?cursor=nope')).status).toBe(400);
  });
});
