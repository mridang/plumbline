/**
 * On-page content rules ported from the Roctify SEO checker
 * (https://roctify.com/tools/seo-checker): content length, keywords, URL
 * shape, links, anchor text and obsolete HTML. Roctify publishes the name of
 * each check but not its thresholds, so the limits here are ours, taken from
 * common search guidance, and are named as constants.
 *
 * Everything is a pure function over strings and plain objects so it can be
 * tested without a scan.
 */
import { finding, type Finding } from '../headers/finding.js';

/** Roctify lists no page per check, so every Roctify hint links the tool. */
export const ROCTIFY_REF = 'https://roctify.com/tools/seo-checker';

/** Pages with fewer words than this are commonly treated as thin content. */
export const MIN_WORDS = 300;

/** URLs longer than this are truncated in search results and hard to share. */
export const MAX_URL_LENGTH = 115;

/** Paths with more segments than this bury the page deep in the site. */
export const MAX_PATH_SEGMENTS = 5;

/** More query parameters than this make a URL look like a session or filter. */
export const MAX_QUERY_PARAMS = 2;

const ENTITIES: Readonly<Record<string, string>> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** Elements whose content is not text a visitor reads. */
const NON_TEXT =
  /<(script|style|noscript|template|head|svg)\b[\s\S]*?<\/\1\s*>/gi;

/** Removes trailing characters matching `drop`, scanning once from the end. */
function trimEnd(value: string, drop: RegExp): string {
  let end = value.length;
  while (end > 0 && drop.test(value[end - 1])) {
    end -= 1;
  }
  return value.slice(0, end);
}

/** Returns the text a visitor reads in `html`, with whitespace collapsed. */
export function visibleText(html: string): string {
  return (
    html
      .replaceAll(/<!--[\s\S]*?-->/g, ' ')
      .replaceAll(NON_TEXT, ' ')
      // eslint-disable-next-line sonarjs/super-linear-regex -- tag stripping of a fetched page; only long runs of unclosed '<' are slow
      .replaceAll(/<[^>]*>/g, ' ')
      .replaceAll(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, (entity) => {
        return ENTITIES[entity.toLowerCase()] ?? ' ';
      })
      .replaceAll(/\s+/g, ' ')
      .trim()
  );
}

/** Splits text into words; apostrophes and hyphens stay inside a word. */
export function wordsOf(text: string): string[] {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
}

/** Warns when the page has too little text. */
export function contentLengthFindings(wordCount: number): Finding[] {
  if (wordCount >= MIN_WORDS) {
    return [];
  }
  return [
    finding(
      'warning',
      `The page has ${wordCount} words of text. Pages with fewer than ${MIN_WORDS} words are often judged thin content.`,
    ),
  ];
}

/** Common English words that say nothing about a page's topic. */
const STOP_WORDS = new Set(
  (
    'about above after again all also and any are because been before being below between both but ' +
    'can cannot could did does doing down during each few for from further had has have having her here ' +
    'hers him his how into its itself just like more most much must myself not now off once only other ' +
    'our ours out over own same she should some such than that the their theirs them then there these ' +
    'they this those through too under until upon very was were what when where which while who whom ' +
    'why will with would you your yours'
  ).split(' '),
);

/** A keyword and how often it appears. */
export interface Keyword {
  word: string;
  count: number;
}

/**
 * The most frequent words of `text` that are at least three letters, not
 * numbers and not stop words. A word must appear twice to count.
 */
export function topKeywords(text: string, limit = 5): Keyword[] {
  const counts = new Map<string, number>();
  for (const raw of wordsOf(text)) {
    const word = trimEnd(raw.toLowerCase().replace(/^['’-]+/, ''), /['’-]/);
    if (
      word.length < 3 ||
      STOP_WORDS.has(word) ||
      /^[\p{N}'’-]+$/u.test(word)
    ) {
      continue;
    }
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([word, count]) => ({ word, count }))
    .toSorted((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

/** Lists the most frequent keywords as advice. */
export function frequentKeywordsFindings(
  keywords: readonly Keyword[],
): Finding[] {
  if (keywords.length === 0) {
    return [];
  }
  const shown = keywords.map((k) => `${k.word} (${k.count})`).join(', ');
  return [
    finding(
      'hint',
      `The most frequent keywords on the page are ${shown}. They should describe what the page is about.`,
    ),
  ];
}

/** Warns when none of the three most frequent keywords is in the title. */
export function keywordsInTitleFindings(
  title: string | null,
  keywords: readonly Keyword[],
): Finding[] {
  const top = keywords.slice(0, 3);
  if (!title || top.length === 0) {
    return [];
  }
  const lowered = title.toLowerCase();
  if (top.some((k) => lowered.includes(k.word))) {
    return [];
  }
  const shown = top.map((k) => k.word).join(', ');
  return [
    finding(
      'warning',
      `None of the page's most frequent keywords (${shown}) appears in the title.`,
    ),
  ];
}

/** Checks that the URL is short, lower-case and readable. */
export function friendlyUrlFindings(url: string): Finding[] {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [];
  }
  const out: Finding[] = [];
  const problem = (message: string) => out.push(finding('warning', message));
  const path = parsed.pathname;
  if (url.length > MAX_URL_LENGTH) {
    problem(
      `The URL is ${url.length} characters long; keep it under ${MAX_URL_LENGTH}.`,
    );
  }
  if (path !== path.toLowerCase()) {
    problem('The URL path has upper-case letters; use lower case only.');
  }
  if (path.includes('_')) {
    problem('The URL path has underscores; separate words with hyphens.');
  }
  if (/%[0-9a-f]{2}/i.test(path)) {
    problem('The URL path has encoded characters; use plain ASCII words.');
  }
  const segments = path.split('/').filter((segment) => segment !== '');
  if (segments.length > MAX_PATH_SEGMENTS) {
    problem(
      `The URL path has ${segments.length} levels; keep it to ${MAX_PATH_SEGMENTS} or fewer.`,
    );
  }
  const params = [...parsed.searchParams.keys()].length;
  if (params > MAX_QUERY_PARAMS) {
    problem(
      `The URL has ${params} query parameters; use a readable path instead.`,
    );
  }
  return out;
}

/** What the link check needs to know about an `<a href>`. */
export interface LinkInfo {
  href: string;
}

/** Hosts compare equal with or without a leading `www.`. */
function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

/** Warns when the page links nowhere or only to other sites. */
export function linkFindings(
  links: readonly LinkInfo[],
  pageUrl: string,
): Finding[] {
  let page: URL;
  try {
    page = new URL(pageUrl);
  } catch {
    return [];
  }
  let total = 0;
  let internal = 0;
  for (const { href } of links) {
    const trimmed = href.trim();
    if (/^(#|mailto:|tel:|javascript:|data:)/i.test(trimmed)) {
      continue;
    }
    try {
      const target = new URL(trimmed, page);
      if (/^https?:$/.test(target.protocol)) {
        total += 1;
        internal += bareHost(target.host) === bareHost(page.host) ? 1 : 0;
      }
    } catch {
      // An unparseable href is not a link a crawler can follow.
    }
  }
  if (total === 0) {
    return [
      finding(
        'warning',
        'The page has no links, so crawlers cannot go further.',
      ),
    ];
  }
  if (internal === 0) {
    return [
      finding(
        'warning',
        `The page has ${total} links but none to its own site; add internal links.`,
      ),
    ];
  }
  return [];
}

/** What the anchor-text check needs to know about an `<a>`. */
export interface AnchorInfo {
  text: string;
  /** The `aria-label`, or an empty string. */
  label: string;
  /** The `alt` of an image inside the link, or an empty string. */
  imageAlt: string;
  /** The `title`, or an empty string. */
  title: string;
}

/** Link texts that say nothing about the target. */
const GENERIC_ANCHORS = new Set([
  'click here',
  'here',
  'read more',
  'more',
  'learn more',
  'more info',
  'more information',
  'link',
  'this link',
  'this',
  'click',
  'details',
  'continue',
  'continue reading',
  'read on',
  'see more',
  'view more',
  'go',
]);

/** How an anchor fails: no accessible text at all, or text that says nothing. */
export type AnchorProblem = 'empty' | 'generic';

/** Classifies one anchor; null when its text is descriptive. */
export function anchorProblem(anchor: AnchorInfo): AnchorProblem | null {
  const shown = [anchor.text, anchor.label, anchor.imageAlt, anchor.title]
    .map((value) => value.replaceAll(/\s+/g, ' ').trim())
    .find((value) => value !== '');
  if (shown === undefined) {
    return 'empty';
  }
  const lowered = shown.toLowerCase();
  const normal = trimEnd(lowered, /[\s.…»›→>]/u).trim();
  return GENERIC_ANCHORS.has(normal) ? 'generic' : null;
}

/** Warns about links with no text or with generic text. */
export function anchorFindings(problems: readonly AnchorProblem[]): Finding[] {
  const empty = problems.filter((p) => p === 'empty').length;
  const generic = problems.filter((p) => p === 'generic').length;
  const out: Finding[] = [];
  if (empty > 0) {
    out.push(
      finding('warning', `${empty} links have no text, label or image alt.`),
    );
  }
  if (generic > 0) {
    out.push(
      finding(
        'warning',
        `${generic} links use generic text such as "click here" or "read more"; describe the target instead.`,
      ),
    );
  }
  return out;
}

/** Elements the HTML standard marks obsolete. */
export const DEPRECATED_TAGS: readonly string[] = [
  'acronym',
  'applet',
  'basefont',
  'bgsound',
  'big',
  'blink',
  'center',
  'dir',
  'font',
  'frame',
  'frameset',
  'isindex',
  'keygen',
  'listing',
  'marquee',
  'menuitem',
  'multicol',
  'nextid',
  'nobr',
  'noembed',
  'noframes',
  'plaintext',
  'rb',
  'rtc',
  'spacer',
  'strike',
  'tt',
  'xmp',
];

/** Warns about obsolete elements; `counts` maps a tag name to its uses. */
export function deprecatedTagFindings(
  counts: Readonly<Record<string, number>>,
): Finding[] {
  const used = Object.entries(counts).filter(([, count]) => count > 0);
  if (used.length === 0) {
    return [];
  }
  const shown = used.map(([tag, count]) => `<${tag}> (${count})`).join(', ');
  return [
    finding(
      'warning',
      `The page uses obsolete HTML elements: ${shown}. Replace them with HTML5 and CSS.`,
    ),
  ];
}

/** Flags a response that is not a plain success. */
export function httpStatusFindings(status: number): Finding[] {
  if (status === 200) {
    return [];
  }
  if (status >= 400) {
    return [
      finding(
        'error',
        `The page answered with HTTP ${status}; search engines will not index it.`,
      ),
    ];
  }
  if (status >= 300) {
    return [
      finding(
        'warning',
        `The page answered with HTTP ${status}, a redirect; link to the final URL.`,
      ),
    ];
  }
  return [finding('hint', `The page answered with HTTP ${status}, not 200.`)];
}
