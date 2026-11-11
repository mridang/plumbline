import { createRequire } from 'node:module';
import { Analyzer, Configuration } from 'hint';
import type { Problem } from '@hint/utils-types';
import connectorPuppeteer from '@hint/connector-puppeteer';
import parserHtml from '@hint/parser-html';
import extraHints from '@mridang/webhint-hint-plumbline';

// The connector and the parser are CommonJS packages with a default export.
const { default: PuppeteerConnector } = connectorPuppeteer;
const { default: HTMLParser } = parserHtml;

// The connector still calls `page.removeListener`, which newer Puppeteer
// renamed to `off` (a page is an event emitter whose `off` does the same).
// Patch the copy the connector itself loads, whichever version that is. Its
// `detached` and `ignoreHTTPSErrors` options also changed in newer
// Puppeteer, so leave them unset.
// Resolved from the connector's own location, since this package does not
// depend on Puppeteer directly.
const connectorRequire = createRequire(
  import.meta.resolve('@hint/connector-puppeteer'),
);
const { Page } = connectorRequire('puppeteer-core') as {
  Page: { prototype: { removeListener?: unknown; off?: unknown } };
};
const pagePrototype = Page.prototype;
if (typeof pagePrototype.removeListener !== 'function') {
  pagePrototype.removeListener = pagePrototype.off;
}

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
  Object.keys(hintMap).toSorted((a, b) => a.localeCompare(b)),
);

/** The hint constructors for a list of ids, for the formatter's `resources`. */
export function hintCtors(ids: readonly string[]): HintCtor[] {
  return ids
    .map((id) => hintMap[id])
    .filter((ctor): ctor is HintCtor => !!ctor);
}

/**
 * A hint's catalogue entry, used by the report, the Docker server's `/hints`
 * endpoint and `plumbline checks`.
 */
export interface HintMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  groups: string[];
  /** Where the hint is placed in the taxonomy; absent for a hint without it. */
  section?: string;
  tier?: string;
  target?: string;
  control?: string;
  tags?: string[];
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
    ...(typeof docs.section === 'string' ? { section: docs.section } : {}),
    ...(typeof docs.tier === 'string' ? { tier: docs.tier } : {}),
    ...(typeof docs.target === 'string' ? { target: docs.target } : {}),
    ...(typeof docs.control === 'string' ? { control: docs.control } : {}),
    ...(Array.isArray(docs.tags)
      ? { tags: docs.tags.filter((t): t is string => typeof t === 'string') }
      : {}),
  };
}

/** The catalogue of every shipped hint. */
export function hintCatalogue(): HintMeta[] {
  return allHintIds.map((id) => metaOf(id));
}

/**
 * The `hints` section of a webhint config for the given ids. The hint classes
 * are handed to the analyzer directly (see `scan`), so webhint matches each
 * config key against the class's own `meta.id`, which is `extra/<id>`.
 * @param ids - Bare hint ids (no `extra/` prefix).
 * @returns A map of `extra/<id>` to the `'default'` severity, so every hint
 * keeps the level its rule defines.
 */
export function hintConfig(ids: readonly string[]): Record<string, string> {
  return Object.fromEntries(ids.map((id) => [`extra/${id}`, 'default']));
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
 * The scan runs in real Node, so the checks that open sockets, TLS
 * connections or mail sessions work, unlike in the browser-run web app.
 *
 * The connector, the HTML parser and the hint classes are handed to the
 * analyzer directly instead of being looked up by name. Webhint's own lookup
 * searches the working directory and the global install with `require`, which
 * misses packages installed by `npx` in its cache and cannot load the hints
 * package (an ES module) at all under Jest; handing the classes over avoids
 * both, the same way the hints package's own tests build their analyzer.
 * @param url - The absolute URL to scan.
 * @param options - Which hints to run and how to launch the browser.
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
  const configuration = Configuration.fromConfig({
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
    hints: hintConfig(ids),
    parsers: ['html'],
  } as unknown as Parameters<typeof Configuration.fromConfig>[0]);
  // The constructor is marked private, but it is the only way to hand the
  // analyzer resources that webhint has not looked up itself; this is what
  // `createAnalyzer` does after its lookup, with the same resource shape.
  const analyzer = Reflect.construct(Analyzer, [
    configuration,
    {
      connector: PuppeteerConnector,
      formatters: [],
      hints: hintCtors(ids),
      incompatible: [],
      missing: [],
      parsers: [HTMLParser],
    },
    [],
  ]) as Analyzer;
  const [result] = await analyzer.analyze(url);
  return {
    problems: result?.problems ?? [],
    hints: ids.map((id) => metaOf(id)),
  };
}
