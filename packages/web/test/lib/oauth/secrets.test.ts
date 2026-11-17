import { describe, expect, it } from '@jest/globals';

// eslint-disable-next-line unicorn/no-keyword-prefix -- newSecret is the name exported by @/lib/oauth
import { hashSecret, newSecret } from '@/lib/oauth';

/** Matches a freshly generated access secret. */
const ACCESS_SECRET_PATTERN = /^cdn_at_[A-Za-z0-9_-]{43}$/u;

/** Matches a 64 character lowercase hexadecimal digest. */
const SHA_256_HEX_PATTERN = /^[0-9a-f]{64}$/u;

describe('newSecret', () => {
  it('is prefixed, url-safe and different every time', () => {
    const a = newSecret('cdn_at');
    const b = newSecret('cdn_at');
    expect(a).toMatch(ACCESS_SECRET_PATTERN);
    expect(a).not.toBe(b);
  });
});

describe('hashSecret', () => {
  it('is a stable 64-character hex digest that is not the secret', async () => {
    const hash = await hashSecret('cdn_at_example');
    expect(hash).toMatch(SHA_256_HEX_PATTERN);
    expect(hash).toBe(await hashSecret('cdn_at_example'));
    expect(hash).not.toContain('example');
  });

  it('differs for different secrets', async () => {
    expect(await hashSecret('a')).not.toBe(await hashSecret('b'));
  });
});
