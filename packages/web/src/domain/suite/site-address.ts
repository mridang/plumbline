/**
 * @packageDocumentation
 *
 * Which addresses can be a site of a repository. A deployment names its address
 * (`environment_url`), `plumbline.yaml` lists sites, and the Website field is a
 * last resort; all three go through the same test, so a page on GitHub itself,
 * a package registry, an address with a login in it or one that is not https is
 * never taken for the site.
 */

import { parseHost } from '@/domain/api/domain-resource';
import { isRegistryHost } from '@/domain/github/deployments';

/** The host of an address that can be a site, or why it cannot. */
export type SiteAddress =
  | { readonly ok: true; readonly host: string }
  | { readonly ok: false; readonly reason: string };

/** GitHub's own addresses: an Actions job page is not the site that was deployed. */
const GITHUB_HOST = /(^|\.)github\.(com|io)$/;

/**
 * The host of `value`, an https address or a bare host name. An `http:` (or any
 * other) scheme is refused: a site is checked over https. Addresses on GitHub,
 * on a package registry or app store, and anything that is not a public domain
 * name are refused too.
 */
export function siteAddress(value: unknown): SiteAddress {
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, reason: 'is not an address' };
  }
  const text = value.trim();
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(text)?.[1];
  if (scheme !== undefined && scheme.toLowerCase() !== 'https') {
    return { ok: false, reason: 'is not an https address' };
  }
  const parsed = parseHost(text);
  if (!parsed.ok) {
    return { ok: false, reason: 'is not a public domain name' };
  }
  if (GITHUB_HOST.test(parsed.value) || isRegistryHost(parsed.value)) {
    return { ok: false, reason: 'is not a site (GitHub or a registry)' };
  }
  return { ok: true, host: parsed.value.toLowerCase() };
}
