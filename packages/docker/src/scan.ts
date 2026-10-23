import { createAnalyzer } from 'hint';
import type { Problem } from '@hint/utils-types';
import extraHints from '@mridang/webhint-hint-extra';

/**
 * A webhint hint class as the hints package exports it: a constructor with a
 * static `meta` whose `docs` carries the extra fields this project stamps on.
 * Webhint does not type `meta.docs` precisely, so the shape is read loosely.
 */
interface HintCtor {
  meta?: { docs?: Record<string, unknown> };
}

/** The hint map the hints package default-exports, keyed by bare hint id. */
const hintMap = extraHints as unknown as Record<string, HintCtor>;

/** Every hint id the package ships, without the `extra/` prefix. */
export const allHintIds: readonly string[] = Object.freeze(
  Object.keys(hintMap).sort(),
);

/** The hint constructors for a list of ids, for the formatter's `resources`. */
export function hintCtors(ids: readonly string[]): HintCtor[] {
  return ids
    .map((id) => hintMap[id])
    .filter((ctor): ctor is HintCtor => !!ctor);
}

/** A hint's catalogue entry, used by the report and the `/hints` endpoint. */
export interface HintMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  groups: string[];
}

/** Reads the stamped metadata off one hint, defaulting anything missing. */
function metaOf(id: string): HintMeta {
  const docs = hintMap[id]?.meta?.docs ?? {};
  return {
    id,
    name: typeof docs.name === 'string' ? docs.name : id,
    description: typeof docs.description === 'string' ? docs.description : '',
    category: typeof docs.category === 'string' ? docs.category : 'other',
    groups: Array.isArray(docs.groups)
      ? docs.groups.filter((g): g is string => typeof g === 'string')
      : [],
  };
}

/** The catalogue of every shipped hint. */
export function hintCatalogue(): HintMeta[] {
  return allHintIds.map(metaOf);
}

/**
 * The `hints` section of a webhint config for the given ids. Webhint resolves
 * a multi-hint package's hints from node_modules by the package-qualified key
 * `<package>/<id>` (what `.hintrc` uses); the `extra/` short prefix only works
 * when the hint classes are handed to the analyzer directly.
 *
 * @param ids Bare hint ids (no `extra/` prefix).
 * @returns A map of package-qualified hint key to the `'default'` severity.
 */
export function hintConfig(ids: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    ids.map((id) => [`@mridang/webhint-hint-extra/${id}`, 'default']),
  );
}

/** Options for a scan; every field is optional and has a sensible default. */
export interface ScanOptions {
  /** Bare hint ids to run (no `extra/` prefix); defaults to every hint. */
  hints?: readonly string[];
  /** Path to the Chromium/Chrome binary the puppeteer connector should use. */
  executablePath?: string;
  /** Chromium launch arguments; defaults suit an unprivileged container. */
  browserArgs?: readonly string[];
}

/** What a scan produces: the raw problems and the hints that ran. */
export interface ScanResult {
  problems: Problem[];
  hints: HintMeta[];
}

/**
 * Runs a real webhint scan of a live URL with the given hints (every hint by
 * default) using the puppeteer connector, and returns the problems it found.
 *
 * Resources (the `extra/*` hints, the puppeteer connector, the HTML parser)
 * are resolved from `node_modules` the normal webhint way, so the Docker image
 * only has to install this package's dependencies.
 *
 * @param url The absolute URL to scan.
 * @param options Which hints to run and how to launch the browser.
 * @returns The problems reported and the metadata of the hints that ran.
 */
export async function scan(
  url: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const ids =
    options.hints && options.hints.length > 0
      ? options.hints.filter((id) => id in hintMap)
      : allHintIds;
  const hints = hintConfig(ids);
  // The puppeteer connector's `headless`/`puppeteerOptions` and the hint
  // severity map are not in webhint's broad config types, so the assembled
  // config is cast once to the type `createAnalyzer` accepts.
  const config = {
    connector: {
      name: 'puppeteer',
      options: {
        headless: true,
        puppeteerOptions: {
          ...(options.executablePath
            ? { executablePath: options.executablePath }
            : {}),
          // Chromium cannot use its sandbox as an unprivileged container user,
          // and the default container's /dev/shm is too small for it.
          args: [
            ...(options.browserArgs ?? [
              '--no-sandbox',
              '--disable-dev-shm-usage',
            ]),
          ],
        },
      },
    },
    formatters: [],
    hints,
    parsers: ['html'],
  };
  const analyzer = createAnalyzer(
    config as unknown as Parameters<typeof createAnalyzer>[0],
  );
  const [result] = await analyzer.analyze(url);
  return { problems: result?.problems ?? [], hints: ids.map(metaOf) };
}
