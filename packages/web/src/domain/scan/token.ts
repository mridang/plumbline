/**
 * @packageDocumentation
 *
 * A scan's id: the address being scanned and when the scan ends, signed with
 * the app's `SCAN_SECRET` so nobody can make one up. Nothing is stored; the id
 * carries all there is to know, and the signature proves the app issued it.
 * Only a holder of a live id may have the Worker fetch on a scan's behalf (see
 * `forward.ts`), so the fetches cannot be had without first asking for a scan,
 * which is rate limited, and stop when the scan ends.
 *
 * The id is `<payload>.<signature>`, both base64url: the payload is the JSON
 * `{"u": url, "e": expiry in epoch seconds}` and the signature its HMAC-SHA256.
 */

import {
  base64UrlToBytes,
  bufferSource,
  bytesToBase64Url,
} from '@/utils/base64';

/** How long a scan may go on fetching, in seconds. */
export const SCAN_LIFETIME_SECONDS = 600;

/** A scan, as its id describes it. */
export interface ScanClaim {
  /** The address being scanned. */
  readonly url: string;
  /** When the scan ends. */
  readonly expiresAt: Date;
}

/** The HMAC key for `secret`. */
function keyFor(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * The id of a new scan of `url`, signed with `secret`, ending
 * {@link SCAN_LIFETIME_SECONDS} after `now`.
 */
export async function issueScanId(
  url: string,
  secret: string,
  now: Date = new Date(),
): Promise<{ readonly id: string; readonly claim: ScanClaim }> {
  const expiry = Math.floor(now.getTime() / 1000) + SCAN_LIFETIME_SECONDS;
  const payload = new TextEncoder().encode(
    JSON.stringify({ u: url, e: expiry }),
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    await keyFor(secret),
    bufferSource(payload),
  );
  return {
    id: `${bytesToBase64Url(payload)}.${bytesToBase64Url(new Uint8Array(signature))}`,
    claim: { url, expiresAt: new Date(expiry * 1000) },
  };
}

/** The payload's fields, when it is the JSON an id carries. */
function claimOf(payload: Uint8Array): ScanClaim | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(payload));
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const { u, e } = value as Record<string, unknown>;
    return typeof u === 'string' && typeof e === 'number'
      ? { url: u, expiresAt: new Date(e * 1000) }
      : null;
  } catch {
    return null;
  }
}

/**
 * What a scan id says, or null when it is not one this app signed with
 * `secret` or the scan has ended. The signature is checked by Web Crypto, which
 * compares in constant time.
 */
export async function readScanId(
  id: string,
  secret: string,
  now: Date = new Date(),
): Promise<ScanClaim | null> {
  const [payloadText, signatureText, extra] = id.split('.');
  if (!payloadText || !signatureText || extra !== undefined) {
    return null;
  }
  let payload: Uint8Array;
  let signature: Uint8Array;
  try {
    payload = base64UrlToBytes(payloadText);
    signature = base64UrlToBytes(signatureText);
  } catch {
    return null;
  }
  const genuine = await crypto.subtle.verify(
    'HMAC',
    await keyFor(secret),
    bufferSource(signature),
    bufferSource(payload),
  );
  if (!genuine) {
    return null;
  }
  const claim = claimOf(payload);
  return claim && claim.expiresAt.getTime() > now.getTime() ? claim : null;
}
