/**
 * @packageDocumentation
 *
 * `node:url` for a browser, as far as the hints use it: the ASCII form of a
 * domain name, which the URL parser works out.
 */

/** The punycode form of `domain`, or `''` when it is not a valid name, as Node's. */
export function domainToASCII(domain: string): string {
  try {
    return new URL(`http://${domain}/`).hostname;
  } catch {
    return '';
  }
}
