/**
 * @packageDocumentation
 *
 * Finding out whether a repository is a deployed web application, and where.
 * A Cloudflare Worker that is served from a custom domain says so in its
 * Wrangler configuration (`routes` or `route`), and a repository's own
 * "website" field often names the live site. Those are the hosts to check.
 * Wildcard routes, workers.dev addresses (the account's subdomain is not in
 * the repository) and anything that is not a public dotted name are left out.
 */

import { parseHost } from '@/domain/api/domain-resource';
import type { DeploymentStatus } from '@/domain/suite/deploy';

/** The Wrangler configuration file names. */
const WRANGLER_FILE = /(^|\/)wrangler\.(jsonc|json|toml)$/;

/** Paths that hold copies of someone else's configuration. */
const VENDORED =
  /(^|\/)(node_modules|vendor|\.git|\.next|\.open-next|dist|build)\//;

/** Whether a repository path is a Wrangler configuration worth reading. */
export function isWranglerPath(path: string): boolean {
  return WRANGLER_FILE.test(path) && !VENDORED.test(path);
}

/** JSON with `//` and block comments and trailing commas (what Wrangler allows), as plain JSON text. */
export function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const next = text.charAt(i + 1);
    if (inString) {
      out += char;
      if (char === '\\') {
        out += next;
        i += 1;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === '/' && next === '/') {
      while (i < text.length && text.charAt(i) !== '\n') {
        i += 1;
      }
      out += '\n';
    } else if (char === '/' && next === '*') {
      i += 2;
      while (
        i < text.length &&
        !(text.charAt(i) === '*' && text.charAt(i + 1) === '/')
      ) {
        i += 1;
      }
      i += 1;
    } else {
      out += char;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/** The public host a route pattern serves, or undefined for a wildcard or anything else. */
export function hostOfPattern(pattern: string): string | undefined {
  const bare = pattern
    .trim()
    .replace(/^[a-z]+:\/\//i, '')
    .split(/[/?#]/)[0];
  if (!bare || bare.includes('*') || bare.endsWith('.workers.dev')) {
    return undefined;
  }
  const host = parseHost(bare);
  return host.ok ? host.value : undefined;
}

/** The route patterns of a parsed `routes`/`route` value. */
function patternsOf(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value];
  return list.flatMap((entry): string[] => {
    if (typeof entry === 'string') {
      return [entry];
    }
    if (entry && typeof entry === 'object' && 'pattern' in entry) {
      return typeof entry.pattern === 'string' ? [entry.pattern] : [];
    }
    return [];
  });
}

/** The top-level routes of a `wrangler.json` or `wrangler.jsonc`. */
function jsonPatterns(text: string): string[] {
  try {
    const config: unknown = JSON.parse(stripJsonComments(text));
    if (!config || typeof config !== 'object') {
      return [];
    }
    const record = config as Record<string, unknown>;
    return [...patternsOf(record['routes']), ...patternsOf(record['route'])];
  } catch {
    return [];
  }
}

/** The top-level routes of a `wrangler.toml`, before any `[env.*]` table. */
function tomlPatterns(text: string): string[] {
  const top = text.split(/^\s*\[+env\./m)[0] ?? '';
  const out: string[] = [];
  for (const match of top.matchAll(/^\s*(?:pattern|route)\s*=\s*"([^"]+)"/gm)) {
    out.push(match[1] ?? '');
  }
  for (const array of top.matchAll(/^\s*routes\s*=\s*\[([^\]]*)\]/gm)) {
    for (const item of (array[1] ?? '').matchAll(/"([^"]+)"/g)) {
      out.push(item[1] ?? '');
    }
  }
  return out;
}

/** The hosts a Wrangler configuration serves the Worker from. */
export function wranglerHosts(path: string, text: string): string[] {
  const patterns = path.endsWith('.toml')
    ? tomlPatterns(text)
    : jsonPatterns(text);
  return unique(patterns.map(hostOfPattern));
}

/**
 * Package registries and app stores. A library's website field often links to
 * its page there, but that page is not a site the repository deploys, so it is
 * not a host to check. A subdomain of one of these is left out too.
 */
export const REGISTRY_HOSTS: readonly string[] = [
  'addons.mozilla.org',
  'apps.apple.com',
  'central.sonatype.com',
  'chrome.google.com',
  'chromewebstore.google.com',
  'cocoapods.org',
  'crates.io',
  'docs.rs',
  'hex.pm',
  'hub.docker.com',
  'marketplace.visualstudio.com',
  'mvnrepository.com',
  'npmjs.com',
  'nuget.org',
  'packagist.org',
  'pkg.go.dev',
  'play.google.com',
  'plugins.gradle.org',
  'plugins.traefik.io',
  'pub.dev',
  'pypi.org',
  'pypi.python.org',
  'rubygems.org',
  'search.maven.org',
  'swiftpackageindex.com',
];

/** Whether `host` is a package registry or app store, or a subdomain of one. */
export function isRegistryHost(host: string): boolean {
  return REGISTRY_HOSTS.some(
    (registry) => host === registry || host.endsWith(`.${registry}`),
  );
}

/** The host of a repository's website field, when it is a public site. */
export function homepageHost(
  homepage: string | null | undefined,
): string | undefined {
  if (!homepage) {
    return undefined;
  }
  const host = parseHost(homepage);
  return host.ok &&
    !/(^|\.)github\.(com|io)$/.test(host.value) &&
    !isRegistryHost(host.value)
    ? host.value
    : undefined;
}

/** The distinct defined values, in order. */
function unique(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== undefined))];
}

/** The most Wrangler files read in one repository (a monorepo may have a few). */
export const MAX_WRANGLER_FILES = 8;

/** What a repository can say about where it is deployed. */
export interface RepoFiles {
  /** The paths of the repository's files. */
  readonly paths: readonly string[];
  /** The text of a file. */
  read(path: string): Promise<string>;
  /** The repository's website field. */
  readonly homepage?: string | null | undefined;
}

/**
 * The hosts a repository is deployed on: those of its Wrangler configurations
 * and its website field. Empty when it is not a deployed web application. A
 * file that cannot be read is skipped.
 */
export async function deploymentHosts(repo: RepoFiles): Promise<string[]> {
  const files = repo.paths.filter(isWranglerPath).slice(0, MAX_WRANGLER_FILES);
  const found = await Promise.all(
    files.map(async (path) => {
      try {
        return wranglerHosts(path, await repo.read(path));
      } catch {
        return [];
      }
    }),
  );
  return unique([...found.flat(), homepageHost(repo.homepage)]);
}

/** The parts of a webhook delivery the app reads. */
export interface Delivery extends DeploymentStatus {
  readonly action?: string;
  readonly installation?: { readonly id?: number };
  /** The branch a push went to, as `refs/heads/main`. */
  readonly ref?: string;
  /** The commit a push left the branch at. */
  readonly after?: string;
  /** The issue an `issues` delivery is about. */
  readonly issue?: { readonly number?: number };
  /** Who did it. */
  readonly sender?: { readonly login?: string };
  readonly commits?: readonly {
    readonly added?: readonly string[];
    readonly modified?: readonly string[];
    readonly removed?: readonly string[];
  }[];
}

/** Whether a push touched a Wrangler configuration, so where the app is deployed may have changed. */
export function touchesWrangler(delivery: Readonly<Delivery>): boolean {
  return (delivery.commits ?? []).some((commit) =>
    [
      ...(commit.added ?? []),
      ...(commit.modified ?? []),
      ...(commit.removed ?? []),
    ].some(isWranglerPath),
  );
}

/** The configuration file names, in the root of a repository. */
const CONFIG_FILE = /^plumbline\.(yaml|yml|json)$/;

/** Whether a push changed the repository's `plumbline` configuration, which changes the rules. */
export function touchesConfig(delivery: Readonly<Delivery>): boolean {
  return (delivery.commits ?? []).some((commit) =>
    [
      ...(commit.added ?? []),
      ...(commit.modified ?? []),
      ...(commit.removed ?? []),
    ].some((path) => CONFIG_FILE.test(path)),
  );
}

/** Whether a push went to the repository's default branch. */
export function isDefaultBranchPush(delivery: Readonly<Delivery>): boolean {
  const branch = delivery.repository?.default_branch;
  return branch !== undefined && delivery.ref === `refs/heads/${branch}`;
}
