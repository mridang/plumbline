/**
 * @packageDocumentation
 *
 * Checking that a webhook delivery really came from GitHub: it signs the raw
 * body with the shared secret (HMAC-SHA256) and sends the hex digest in
 * `X-Hub-Signature-256`.
 */

const PREFIX = 'sha256=';

/** The hex of some bytes. */
function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/** Whether `signature` is the right signature of `body` under `secret`. */
export async function verifySignature(
  secret: string,
  body: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature?.startsWith(PREFIX)) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = hex(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)),
  );
  const given = signature.slice(PREFIX.length);
  if (given.length !== expected.length) {
    return false;
  }
  // Every character is compared, so the time taken says nothing about where they differ.
  let difference = 0;
  for (let i = 0; i < expected.length; i += 1) {
    difference |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return difference === 0;
}
