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
import { isObject } from '@/lib/core/api/json';
import type { DeploymentStatus } from '@/domain/suite/deploy';

/** The Wrangler configuration file names. */
const WRANGLER_FILE = /(^|\/)wrangler\.(jsonc|json|toml)$/u;

/** Paths that hold copies of someone else's configuration. */
const VENDORED =
  /(^|\/)(node_modules|vendor|\.git|\.next|\.open-next|dist|build)\//u;

/** A URL scheme at the start of a route pattern, such as `https://`. */
const URL_SCHEME_PREFIX = /^[a-z]+:\/\//iu;

/** Where the host of a route pattern ends. */
const HOST_END = /[/?#]/u;

/** A GitHub host, such as `github.com` or `owner.github.io`. */
const GITHUB_HOST = /(^|\.)github\.(com|io)$/u;

/** Whether a repository path is a Wrangler configuration worth reading. */
export function isWranglerPath(path: string): boolean {
  return WRANGLER_FILE.test(path) && !VENDORED.test(path);
}

/** JSON with `//` and block comments and trailing commas (what Wrangler allows), as plain JSON text. */
export function stripJsonComments(text: string): string {
  return text
    .replaceAll(
      /"(?:[^"\\]|\\[^])*"?|\/\/[^\n]*|\/\*[^]*?(?:\*\/|$)/gu,
      (token) => (token.startsWith('"') ? token : ''),
    )
    .replaceAll(/,(\s*[}\]])/gu, '$1');
}

/** The public host a route pattern serves, or undefined for a wildcard or anything else. */
export function hostOfPattern(pattern: string): string | undefined {
  const bare = pattern
    .trim()
    .replace(URL_SCHEME_PREFIX, '')
    .split(HOST_END, 1)[0];
  if (!bare || bare.includes('*') || bare.endsWith('.workers.dev')) {
    return undefined;
  }
  const host = parseHost(bare);
  return host.ok ? host.value : undefined;
}

/** The route patterns of a parsed `routes`/`route` value. */
function patternsOf(value: unknown): string[] {
  const list: unknown[] = Array.isArray(value)
    ? value
    : [value].filter((item) => item !== undefined);
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
    if (!isObject(config)) {
      return [];
    }
    const record = config;
    return [...patternsOf(record['routes']), ...patternsOf(record['route'])];
  } catch {
    return [];
  }
}

const LINE_BREAKS = '\n\r\u2028\u2029';

/** Where the line holding `index` starts when only whitespace precedes it, else -1. */
function leadingLineStart(text: string, index: number): number {
  if (index === 0) {
    return 0;
  }
  const lineStart =
    Math.max(
      ...Array.from(LINE_BREAKS, (c) => text.lastIndexOf(c, index - 1)),
    ) + 1;
  return text.slice(lineStart, index).trim() === '' ? lineStart : -1;
}

/** The text before the first line that opens an `[env.*]` table. */
function beforeEnvTable(text: string): string {
  const start = Array.from(text.matchAll(/(?<!\[)\[+env\./gu), (hit) =>
    leadingLineStart(text, hit.index),
  ).find((at) => at !== -1);
  return start === undefined ? text : text.slice(0, start);
}

/** The matches of `pattern` (global) that begin a line, ignoring indentation. */
function lineMatches(text: string, pattern: RegExp): RegExpExecArray[] {
  return [...text.matchAll(pattern)].filter(
    (match) => leadingLineStart(text, match.index) !== -1,
  );
}

/** The top-level routes of a `wrangler.toml`, before any `[env.*]` table. */
function tomlPatterns(text: string): string[] {
  const top = beforeEnvTable(text);
  return [
    ...lineMatches(top, /(?:pattern|route)\s*=\s*"([^"]+)"/gu).map(
      (match) => match[1] ?? '',
    ),
    ...lineMatches(top, /routes\s*=\s*\[([^\]]*)\]/gu).flatMap((array) =>
      Array.from(
        (array[1] ?? '').matchAll(/"([^"]+)"/gu),
        (item) => item[1] ?? '',
      ),
    ),
  ];
}

/** The hosts a Wrangler configuration serves the Worker from. */
export function wranglerHosts(path: string, text: string): string[] {
  const patterns = path.endsWith('.toml')
    ? tomlPatterns(text)
    : jsonPatterns(text);
  return unique(patterns.map((pattern) => hostOfPattern(pattern)));
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
export function homepageHost(homepage?: string | null): string | undefined {
  if (!homepage) {
    return undefined;
  }
  const host = parseHost(homepage);
  return host.ok && !GITHUB_HOST.test(host.value) && !isRegistryHost(host.value)
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
  readonly homepage?: string | null;
}

/**
 * The hosts a repository suggests it is deployed on: those of its Wrangler
 * configurations, or, when it has none, its website field. The website field
 * is a last resort because it goes stale (a project moves and the field still
 * names the old address), while a route is what the repository really deploys
 * to. Empty when it is not a deployed web application. A file that cannot be
 * read is skipped.
 */
export async function deploymentHosts(repo: RepoFiles): Promise<string[]> {
  const files = repo.paths
    .filter((path) => isWranglerPath(path))
    .slice(0, MAX_WRANGLER_FILES);
  const found = await Promise.all(
    files.map(async (path) => {
      try {
        return wranglerHosts(path, await repo.read(path));
      } catch {
        return [];
      }
    }),
  );
  const routed = unique(found.flat());
  return routed.length > 0 ? routed : unique([homepageHost(repo.homepage)]);
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
    ].some((path) => isWranglerPath(path)),
  );
}

/** The configuration file names, in the root of a repository. */
const CONFIG_FILE = /^plumbline\.(yaml|yml|json)$/u;

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
