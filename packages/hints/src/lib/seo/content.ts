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
import { finding } from '../headers/finding.js';
import type { Finding } from '../headers/finding.js';

/** Compares words in the default locale order. */
const collator = new Intl.Collator();

/** Matches whitespace or title separator punctuation. */
const TITLE_TRAILING_PUNCTUATION = /[\s.…»›→>]/u;

/** Matches an `http:` or `https:` protocol. */
const HTTP_OR_HTTPS_PROTOCOL = /^https?:$/u;

/** Matches a link prefix that does not point to a page. */
const NON_PAGE_LINK_PREFIX = /^(#|mailto:|tel:|javascript:|data:)/iu;

/** Matches a leading `www.`. */
const WWW_PREFIX = /^www\./u;

/** Matches a percent-encoded byte. */
const PERCENT_ESCAPE = /%[0-9a-f]{2}/iu;

/** Matches a word made of numbers, apostrophes and hyphens. */
const NUMERIC_WORD = /^[\p{N}'’-]+$/u;

/** Matches an apostrophe or hyphen. */
const APOSTROPHE_OR_HYPHEN = /['’-]/u;

/** Matches leading apostrophes and hyphens. */
const LEADING_APOSTROPHES = /^['’-]+/u;

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

const ENTITIES = new Map([
  ['&nbsp;', ' '],
  ['&amp;', '&'],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#39;', "'"],
]);

/** Elements whose content is not text a visitor reads. */
const NON_TEXT =
  /<(script|style|noscript|template|head|svg)\b[\s\S]*?<\/\1\s*>/giu;

/** Removes trailing characters matching `drop`, scanning once from the end. */
function trimEnd(value: string, drop: RegExp): string {
  const characters = Array.from(value, (character) => character);
  return characters
    .slice(
      0,
      characters.findLastIndex((character) => !drop.test(character)) + 1,
    )
    .join('');
}

/** Replaces every `<...>` (up to the first `>`) with a space; a lone `<` stays. */
function stripTags(html: string): string {
  const pieces = html.split('>');
  return pieces
    .map((piece, index) => {
      if (index === pieces.length - 1) {
        return piece;
      }
      const open = piece.indexOf('<');
      return open === -1 ? `${piece}>` : `${piece.slice(0, open)} `;
    })
    .join('');
}

/** Returns the text a visitor reads in `html`, with whitespace collapsed. */
export function visibleText(html: string): string {
  return stripTags(
    html.replaceAll(/<!--[\s\S]*?-->/gu, ' ').replaceAll(NON_TEXT, ' '),
  )
    .replaceAll(
      /&(?:nbsp|amp|lt|gt|quot|#39);/giu,
      (entity) => ENTITIES.get(entity.toLowerCase()) ?? ' ',
    )
    .replaceAll(/\s+/gu, ' ')
    .trim();
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
  const groups = Map.groupBy(
    wordsOf(text).flatMap((raw) => {
      const word = trimEnd(
        raw.toLowerCase().replace(LEADING_APOSTROPHES, ''),
        APOSTROPHE_OR_HYPHEN,
      );
      return word.length < 3 || STOP_WORDS.has(word) || NUMERIC_WORD.test(word)
        ? []
        : [word];
    }),
    (word) => word,
  );
  return [...groups]
    .flatMap(([word, list]) =>
      list.length >= 2 ? [{ word, count: list.length }] : [],
    )
    .toSorted((a, b) => b.count - a.count || collator.compare(a.word, b.word))
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
  if (!URL.canParse(url)) {
    return [];
  }
  const parsed = new URL(url);
  const path = parsed.pathname;
  const segments = path.split('/').filter((segment) => segment !== '');
  const params = [...parsed.searchParams.keys()].length;
  return [
    ...(url.length > MAX_URL_LENGTH
      ? [
          finding(
            'warning',
            `The URL is ${url.length} characters long; keep it under ${MAX_URL_LENGTH}.`,
          ),
        ]
      : []),
    ...(path === path.toLowerCase()
      ? []
      : [
          finding(
            'warning',
            'The URL path has upper-case letters; use lower case only.',
          ),
        ]),
    ...(path.includes('_')
      ? [
          finding(
            'warning',
            'The URL path has underscores; separate words with hyphens.',
          ),
        ]
      : []),
    ...(PERCENT_ESCAPE.test(path)
      ? [
          finding(
            'warning',
            'The URL path has encoded characters; use plain ASCII words.',
          ),
        ]
      : []),
    ...(segments.length > MAX_PATH_SEGMENTS
      ? [
          finding(
            'warning',
            `The URL path has ${segments.length} levels; keep it to ${MAX_PATH_SEGMENTS} or fewer.`,
          ),
        ]
      : []),
    ...(params > MAX_QUERY_PARAMS
      ? [
          finding(
            'warning',
            `The URL has ${params} query parameters; use a readable path instead.`,
          ),
        ]
      : []),
  ];
}

/** What the link check needs to know about an `<a href>`. */
export interface LinkInfo {
  href: string;
}

/** Hosts compare equal with or without a leading `www.`. */
function bareHost(host: string): string {
  return host.toLowerCase().replace(WWW_PREFIX, '');
}

/** Warns when the page links nowhere or only to other sites. */
export function linkFindings(
  links: readonly LinkInfo[],
  pageUrl: string,
): Finding[] {
  if (!URL.canParse(pageUrl)) {
    return [];
  }
  const page = new URL(pageUrl);
  // An unparseable href is not a link a crawler can follow.
  const targets = links.flatMap(({ href }) => {
    const trimmed = href.trim();
    if (
      NON_PAGE_LINK_PREFIX.test(trimmed) ||
      !URL.canParse(trimmed, page.href)
    ) {
      return [];
    }
    const target = new URL(trimmed, page);
    return HTTP_OR_HTTPS_PROTOCOL.test(target.protocol) ? [target] : [];
  });
  const total = targets.length;
  const internal = targets.filter(
    (target) => bareHost(target.host) === bareHost(page.host),
  ).length;
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
    .map((value) => value.replaceAll(/\s+/gu, ' ').trim())
    .find((value) => value !== '');
  if (shown === undefined) {
    return 'empty';
  }
  const lowered = shown.toLowerCase();
  const normal = trimEnd(lowered, TITLE_TRAILING_PUNCTUATION).trim();
  return GENERIC_ANCHORS.has(normal) ? 'generic' : null;
}

/** Warns about links with no text or with generic text. */
export function anchorFindings(problems: readonly AnchorProblem[]): Finding[] {
  const empty = problems.filter((p) => p === 'empty').length;
  const generic = problems.filter((p) => p === 'generic').length;
  return [
    ...(empty > 0
      ? [finding('warning', `${empty} links have no text, label or image alt.`)]
      : []),
    ...(generic > 0
      ? [
          finding(
            'warning',
            `${generic} links use generic text such as "click here" or "read more"; describe the target instead.`,
          ),
        ]
      : []),
  ];
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
