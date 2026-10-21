import { describe, expect, it } from '@jest/globals';
import { checkApiCatalog } from '../../../src/lib/agent/api-catalog.js';
import { fakeEnv } from './fake-env.js';

const key = '/.well-known/api-catalog application/linkset+json';

describe('checkApiCatalog', () => {
  it('passes with an anchored entry that has service-desc', async () => {
    const env = fakeEnv({
      [key]: {
        linkset: [
          {
            anchor: 'https://example.com/api',
            'service-desc': [{ href: '/o.json' }],
          },
        ],
      },
    });
    expect((await checkApiCatalog(env)).passed).toBe(true);
  });
  it('accepts service-meta and item links', async () => {
    for (const rel of ['service-meta', 'item']) {
      const env = fakeEnv({
        [key]: {
          linkset: [
            { anchor: 'https://example.com/api', [rel]: [{ href: '/x' }] },
          ],
        },
      });
      expect((await checkApiCatalog(env)).passed).toBe(true);
    }
  });
  it('fails for an entry without relations', async () => {
    const env = fakeEnv({
      [key]: { linkset: [{ anchor: 'https://example.com/api' }] },
    });
    expect((await checkApiCatalog(env)).passed).toBe(false);
  });
  it('fails for an entry without an anchor', async () => {
    const env = fakeEnv({ [key]: { linkset: [{ status: [] }] } });
    expect((await checkApiCatalog(env)).passed).toBe(false);
  });
  it('fails for a missing linkset or catalog', async () => {
    expect((await checkApiCatalog(fakeEnv({ [key]: {} }))).passed).toBe(false);
    expect((await checkApiCatalog(fakeEnv())).detail).toContain(
      '/.well-known/api-catalog was not found',
    );
  });
});
