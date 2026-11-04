import { describe, expect, it } from '@jest/globals';

import { badgePath, signRepo, verifyRepo } from '@/domain/badge/sign';

describe('signRepo and verifyRepo', () => {
  it('gives the same signature for the same repository whatever the case', async () => {
    expect(await signRepo('s', 'Acme/Site')).toBe(
      await signRepo('s', 'acme/site'),
    );
  });

  it('gives each repository and each secret its own signature', async () => {
    const one = await signRepo('s', 'acme/site');
    expect(await signRepo('s', 'acme/other')).not.toBe(one);
    expect(await signRepo('t', 'acme/site')).not.toBe(one);
    expect(one).toMatch(/^[0-9a-f]{20}$/);
  });

  it('accepts its own signature and nothing else', async () => {
    const signature = await signRepo('s', 'acme/site');
    expect(await verifyRepo('s', 'acme/site', signature)).toBe(true);
    expect(await verifyRepo('s', 'acme/site', signature.slice(1))).toBe(false);
    expect(await verifyRepo('s', 'acme/site', '0'.repeat(20))).toBe(false);
    expect(await verifyRepo('s', 'acme/other', signature)).toBe(false);
  });
});

describe('badgePath', () => {
  it('names the repository and ends in the signature and .svg', async () => {
    expect(await badgePath('s', 'acme/site')).toBe(
      `/badge/acme/site/${await signRepo('s', 'acme/site')}.svg`,
    );
  });
});
