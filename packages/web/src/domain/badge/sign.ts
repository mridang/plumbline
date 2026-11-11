/**
 * @packageDocumentation
 *
 * The signature in a repository's badge address. The address
 * `/badge/{owner}/{repo}/{signature}.svg` is public (it is pasted into a
 * README), so the signature is what stops someone reading the standing of a
 * private repository by guessing its name: it is an HMAC of the repository
 * name under the app's secret, so only addresses the app handed out work, and
 * nothing is stored.
 */

/** The signature as lowercase hex, long enough that it cannot be guessed. */
const LENGTH = 20;

/** A secret as an HMAC key. */
function keyOf(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/** The signature for `repo` (`owner/name`, any case). */
export async function signRepo(secret: string, repo: string): Promise<string> {
  const mac = await crypto.subtle.sign(
    'HMAC',
    await keyOf(secret),
    new TextEncoder().encode(`badge:${repo.toLowerCase()}`),
  );
  return [...new Uint8Array(mac)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, LENGTH);
}

/** Whether `signature` is the one for `repo`, compared without stopping at the first difference. */
export async function verifyRepo(
  secret: string,
  repo: string,
  signature: string,
): Promise<boolean> {
  const expected = await signRepo(secret, repo);
  if (signature.length !== expected.length) {
    return false;
  }
  let difference = 0;
  for (let at = 0; at < expected.length; at += 1) {
    difference |=
      (expected.codePointAt(at) ?? 0) ^ (signature.codePointAt(at) ?? 0);
  }
  return difference === 0;
}

/** The address of a repository's badge, relative to the app's origin. */
export async function badgePath(secret: string, repo: string): Promise<string> {
  return `/badge/${repo}/${await signRepo(secret, repo)}.svg`;
}
