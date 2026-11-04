import { describe, expect, it } from '@jest/globals';

import {
  issueScanId,
  readScanId,
  SCAN_LIFETIME_SECONDS,
} from '@/domain/scan/token';

const SECRET = 'test-secret';
const NOW = new Date('2026-10-31T12:00:00Z');

describe('issueScanId', () => {
  it('ends the scan ten minutes from now', async () => {
    const { claim } = await issueScanId('https://example.com/', SECRET, NOW);
    expect(SCAN_LIFETIME_SECONDS).toBe(600);
    expect(claim).toEqual({
      url: 'https://example.com/',
      expiresAt: new Date('2026-10-31T12:10:00Z'),
    });
  });

  it('makes an id that is safe in a URL path', async () => {
    const { id } = await issueScanId('https://example.com/?a=b c', SECRET, NOW);
    expect(id).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});

describe('readScanId', () => {
  it('reads back what the id was issued for', async () => {
    const { id, claim } = await issueScanId(
      'https://example.com/',
      SECRET,
      NOW,
    );
    expect(await readScanId(id, SECRET, NOW)).toEqual(claim);
  });

  it('refuses an id once the scan has ended', async () => {
    const { id } = await issueScanId('https://example.com/', SECRET, NOW);
    const later = new Date(NOW.getTime() + SCAN_LIFETIME_SECONDS * 1000);
    expect(await readScanId(id, SECRET, later)).toBeNull();
  });

  it('refuses an id signed with another secret', async () => {
    const { id } = await issueScanId('https://example.com/', 'other', NOW);
    expect(await readScanId(id, SECRET, NOW)).toBeNull();
  });

  it('refuses an id whose payload was changed', async () => {
    const { id } = await issueScanId('https://example.com/', SECRET, NOW);
    const [, signature] = id.split('.');
    const forged = Buffer.from(
      JSON.stringify({ u: 'https://evil.example/', e: 9_999_999_999 }),
    ).toString('base64url');
    expect(await readScanId(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it.each([
    ['nothing', ''],
    ['no signature', 'abc'],
    ['too many parts', 'a.b.c'],
    ['not base64', '!!!.???'],
  ])('refuses %s', async (_label, id) => {
    expect(await readScanId(id, SECRET, NOW)).toBeNull();
  });

  it('refuses a signed payload that is not a scan', async () => {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    for (const payload of ['"text"', '{"u":1,"e":"x"}', 'not json']) {
      const bytes = new TextEncoder().encode(payload);
      const signature = new Uint8Array(
        await crypto.subtle.sign('HMAC', key, bytes),
      );
      const id = `${Buffer.from(bytes).toString('base64url')}.${Buffer.from(signature).toString('base64url')}`;
      expect(await readScanId(id, SECRET, NOW)).toBeNull();
    }
  });
});
