/**
 * Readers and rules for the technical hints, ported from LLMScout
 * (https://github.com/RudrenduPaul/LLMScout, MIT). They only need a tiny
 * slice of the DOM, so they can be unit tested without running a scan.
 */

/** The part of a DOM element these readers use. */
interface ElementLike {
  /** Webhint's DOM wrapper exposes `nodeName`; browsers also have `tagName`. */
  nodeName?: string;
  tagName?: string;
  getAttribute(name: string): string | null;
}

/** The part of a DOM document these readers use. */
export interface TechDocumentLike {
  querySelector(selector: string): ElementLike | null;
  querySelectorAll(selector: string): ElementLike[];
}

/** Heading levels (1 to 6) in document order. */
export function headingLevels(parsedDocument: TechDocumentLike): number[] {
  return parsedDocument
    .querySelectorAll('h1, h2, h3, h4, h5, h6')
    .map((element) =>
      Number.parseInt((element.nodeName ?? element.tagName ?? '').slice(1), 10),
    )
    .filter((level) => Number.isFinite(level));
}

/** Finds the first heading that jumps down by more than one level; `index` is that heading's position. */
export function firstSkippedLevel(
  levels: readonly number[],
): { from: number; to: number; index: number } | null {
  const index = levels.findIndex(
    (level, position) => position > 0 && level - levels[position - 1] > 1,
  );
  return index === -1
    ? null
    : { from: levels[index - 1], to: levels[index], index };
}

/** Share of images at which missing alt text is only advice, not a failure. */
const ALT_WARN_THRESHOLD = 0.8;

export interface AltCoverage {
  total: number;
  missing: number;
  /** Rounded percentage of images that have an alt attribute. */
  percent: number;
  /** True when coverage is below the warn threshold. */
  failing: boolean;
}

/**
 * Counts `<img>` elements without an `alt` attribute. An empty `alt=""` is
 * valid (it marks a decorative image), only an absent attribute counts.
 * Returns null when there is nothing to report.
 */
export function altCoverage(
  parsedDocument: TechDocumentLike,
): AltCoverage | null {
  const images = parsedDocument.querySelectorAll('img');
  const total = images.length;
  const missing = images.filter(
    (img) => img.getAttribute('alt') === null,
  ).length;
  if (total === 0 || missing === 0) {
    return null;
  }
  const coverage = (total - missing) / total;
  return {
    total,
    missing,
    percent: Math.round(coverage * 100),
    failing: coverage < ALT_WARN_THRESHOLD,
  };
}

/** The advanced snippet and preview directives of the robots meta tag. */
const ADVANCED_DIRECTIVES = [
  'max-snippet',
  'max-image-preview',
  'max-video-preview',
] as const;

export interface RobotsAdvanced {
  /** The lower-cased content of the robots meta tag, empty when absent. */
  content: string;
  present: string[];
  missing: string[];
}

/** Reads which advanced directives the first robots meta tag carries. */
export function robotsAdvanced(
  parsedDocument: TechDocumentLike,
): RobotsAdvanced {
  const content =
    parsedDocument
      .querySelector('meta[name="robots" i]')
      ?.getAttribute('content')
      ?.trim()
      .toLowerCase() ?? '';
  const tokens = content.split(',').map((token) => token.trim());
  const present = ADVANCED_DIRECTIVES.filter((directive) =>
    tokens.some((token) => token.startsWith(directive)),
  );
  return {
    content,
    present,
    missing: ADVANCED_DIRECTIVES.filter(
      (directive) => !present.includes(directive),
    ),
  };
}

/**
 * Resolves the distinct `<img src>` values against the page URL, dropping
 * unparseable ones and anything that is not http(s), such as data: URIs.
 */
export function imageUrls(
  parsedDocument: TechDocumentLike,
  base: string,
): string[] {
  const urls = parsedDocument.querySelectorAll('img').flatMap((img) => {
    const src = img.getAttribute('src');
    if (!src) {
      return [];
    }
    try {
      const url = new URL(src, base);
      return url.protocol === 'http:' || url.protocol === 'https:'
        ? [url.href]
        : [];
    } catch {
      // A malformed src is a markup problem, not a weight problem.
      return [];
    }
  });
  return [...new Set(urls)];
}

/** Per-image size above which a warning is raised. */
const WEIGHT_WARN_BYTES = 200 * 1024;
/** Per-image size above which an error is raised. */
const WEIGHT_FAIL_BYTES = 500 * 1024;

/** Classifies an image size: `fail` over 500 KB, `warn` over 200 KB. */
export function imageWeightLevel(bytes: number): 'ok' | 'warn' | 'fail' {
  if (bytes > WEIGHT_FAIL_BYTES) {
    return 'fail';
  }
  return bytes > WEIGHT_WARN_BYTES ? 'warn' : 'ok';
}

const KB_FORMAT = new Intl.NumberFormat('en', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: false,
});

/** Formats a byte count as kilobytes with one decimal. */
export function formatKb(bytes: number): string {
  return `${KB_FORMAT.format(bytes / 1024)} KB`;
}

/** Runs `fn` over `items` with at most `limit` calls in flight at once. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  // eslint-disable-next-line functional/no-let -- the shared cursor the concurrent workers claim items from
  let next = 0;
  const worker = async (): Promise<[number, R][]> => {
    const index = next;
    next += 1;
    if (index >= items.length) {
      return [];
    }
    const result = await fn(items[index]);
    return [[index, result], ...(await worker())];
  };
  const count = Math.max(1, Math.min(limit, items.length));
  const done = await Promise.all(
    Array.from({ length: count }, async () => worker()),
  );
  const byIndex = new Map(done.flat());
  return items.map((_item, index) => byIndex.get(index) as R);
}

/** More redirect hops than this cost crawl budget and latency. */
const MAX_HOPS = 2;

export interface RedirectVerdict {
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Judges a redirect chain: an error status at the end of the chain is an
 * error, more than two hops is a warning. `hops` are the URLs visited
 * before the final one, as webhint reports them.
 */
export function redirectVerdict(
  hops: readonly string[],
  finalUrl: string,
  finalStatus: number,
): RedirectVerdict | null {
  if (hops.length === 0) {
    return null;
  }
  const chain = [...hops, finalUrl].join(' -> ');
  if (finalStatus >= 400 && finalStatus < 600) {
    return {
      severity: 'error',
      message: `The redirect chain leads to an error status: ${chain} (HTTP ${finalStatus}).`,
    };
  }
  if (hops.length > MAX_HOPS) {
    return {
      severity: 'warning',
      message: `The page resolves through ${hops.length} redirect hops before reaching its final URL: ${chain}.`,
    };
  }
  return null;
}

/** Reads the trimmed href of the first canonical link, or null. */
export function canonicalHref(parsedDocument: TechDocumentLike): string | null {
  const href = parsedDocument
    .querySelector('link[rel~="canonical" i]')
    ?.getAttribute('href')
    ?.trim();
  return href || null;
}

/**
 * True when the value is a usable URL once resolved against `base`. A
 * relative or root-relative reference is legal HTML, so it is accepted as
 * long as it resolves, as LLMScout does.
 */
export function resolvesAsUrl(value: string, base: string): boolean {
  return URL.canParse(value, base);
}

/** The card types X/Twitter recognises. */
export const TWITTER_CARD_TYPES = [
  'summary',
  'summary_large_image',
  'app',
  'player',
] as const;

/** Reads the trimmed `twitter:card` value, or null when absent or blank. */
export function twitterCardType(
  parsedDocument: TechDocumentLike,
): string | null {
  const value = parsedDocument
    .querySelector('meta[name="twitter:card" i]')
    ?.getAttribute('content')
    ?.trim();
  return value || null;
}
