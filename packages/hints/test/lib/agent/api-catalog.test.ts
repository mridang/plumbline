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
    const result = await checkApiCatalog(env);
    expect(result.passed).toBe(true);
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
      const result = await checkApiCatalog(env);
      expect(result.passed).toBe(true);
    }
  });
  it('fails for an entry without relations', async () => {
    const env = fakeEnv({
      [key]: { linkset: [{ anchor: 'https://example.com/api' }] },
    });
    const result = await checkApiCatalog(env);
    expect(result.passed).toBe(false);
  });
  it('fails for an entry without an anchor', async () => {
    const env = fakeEnv({ [key]: { linkset: [{ status: [] }] } });
    const result = await checkApiCatalog(env);
    expect(result.passed).toBe(false);
  });
  it('fails for a missing linkset or catalog', async () => {
    const withoutLinkset = await checkApiCatalog(fakeEnv({ [key]: {} }));
    expect(withoutLinkset.passed).toBe(false);
    const missing = await checkApiCatalog(fakeEnv());
    expect(missing.detail).toContain('/.well-known/api-catalog was not found');
  });
});
