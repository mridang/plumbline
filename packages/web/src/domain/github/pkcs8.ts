/**
 * @packageDocumentation
 *
 * GitHub hands out an app's private key as PKCS#1 (`BEGIN RSA PRIVATE KEY`),
 * which the JWT signer refuses; it wants PKCS#8. This wraps the one in the
 * other, with plain bytes so it runs the same on a Worker and under Jest.
 */

import { base64ToBytes, bytesToBase64 } from '@/utils/base64';

/** The DER header of an `rsaEncryption` algorithm identifier. */
const RSA_ALGORITHM = new Uint8Array([
  48, 13, 6, 9, 42, 134, 72, 134, 247, 13, 1, 1, 1, 5, 0,
]);

/** The DER length bytes for a body of `size` bytes. */
function lengthOf(size: number): number[] {
  if (size < 0x80) {
    return [size];
  }
  // eslint-disable-next-line unicorn/number-literal-case -- conflicts with Prettier formatting
  if (size <= 0xff) {
    return [0x81, size];
  }
  // eslint-disable-next-line unicorn/number-literal-case -- conflicts with Prettier formatting
  return [0x82, size >> 8, size & 0xff];
}

/** A DER element: the tag, the length and the body. */
function der(tag: number, ...body: Uint8Array[]): Uint8Array {
  const size = body.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array([tag, ...lengthOf(size)]);
  const whole = new Uint8Array(out.length + size);
  whole.set(out);
  let at = out.length;
  for (const part of body) {
    whole.set(part, at);
    at += part.length;
  }
  return whole;
}

/**
 * The key as a `BEGIN PRIVATE KEY` (PKCS#8) PEM. A key that is already
 * PKCS#8, or is not an RSA PKCS#1 key, comes back as it was. Newlines written
 * as `\n` or `&` (how a one-line secret carries them) are restored first.
 */
export function toPkcs8(pem: string): string {
  const text = pem.replaceAll(String.raw`\n`, '\n').replaceAll('&', '\n');
  const match =
    /-----BEGIN RSA PRIVATE KEY-----([\s\S]+?)-----END RSA PRIVATE KEY-----/.exec(
      text,
    );
  if (match === null) {
    return text;
  }
  const pkcs1 = base64ToBytes((match[1] ?? '').replaceAll(/\s+/g, ''));
  const pkcs8 = der(
    0x30,
    new Uint8Array([0x02, 0x01, 0x00]),
    RSA_ALGORITHM,
    der(0x04, pkcs1),
  );
  const lines = bytesToBase64(pkcs8).match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
}
