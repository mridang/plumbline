import { createHmac } from 'node:crypto';

import { describe, expect, it } from '@jest/globals';

import { verifySignature } from '@/domain/github/webhook';

const sign = (secret: string, body: string) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('verifySignature', () => {
  it('accepts the signature GitHub would send', async () => {
    expect(
      await verifySignature('s3cret', '{"a":1}', sign('s3cret', '{"a":1}')),
    ).toBe(true);
  });

  it('refuses a signature made with another secret or for another body', async () => {
    expect(await verifySignature('s3cret', 'x', sign('other', 'x'))).toBe(
      false,
    );
    expect(await verifySignature('s3cret', 'x', sign('s3cret', 'y'))).toBe(
      false,
    );
  });

  it('refuses a missing, unprefixed or wrong-length signature', async () => {
    expect(await verifySignature('s', 'x', null)).toBe(false);
    expect(await verifySignature('s', 'x', sign('s', 'x').slice(7))).toBe(
      false,
    );
    expect(await verifySignature('s', 'x', 'sha256=abc')).toBe(false);
  });
});
