import { isAbsoluteUrl, splitLines } from './issue.js';
import type { FileIssue } from './issue.js';

/** Matches a file extension glob or a path. */
const PATH_OR_EXTENSION_PATTERN = /^(\*?\.\w+|\/\S*|\*\.\w+)$/u;

/** Matches a run of whitespace or commas. */
const WHITESPACE_OR_COMMA_RUN = /[\s,]+/u;

/** Matches a single whitespace character. */
const WHITESPACE_CHAR = /\s/u;

/** Matches the level-two Markdown heading marker and its spacing. */
const H2_HEADING_MARKER = /^##\s+/u;

/** Matches a level-two Markdown heading prefix. */
const H2_HEADING_PREFIX = /^##\s/u;

/** Matches a level-one Markdown heading with text. */
const H1_HEADING = /^#\s+\S/u;

/** Matches an ISO `YYYY-MM-DD` date. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/** Matches a `Key: value` line. */
const KEY_VALUE_LINE = /^([A-Za-z_-]+)\s*:(.*)$/u;

/** Matches a robots-style `User-agent:` directive line. */
const USER_AGENT_DIRECTIVE = /^user-agent\s*:/imu;

/** Matches a Markdown heading line anywhere in the text. */
const MARKDOWN_HEADING_LINE_MULTILINE = /^#\s/mu;

/** Matches a leading byte order mark. */
const LEADING_BOM = /^\uFEFF/u;

export type AiTxtFormat = 'markdown' | 'spawning';

/** Picks the format by looking for front matter or robots style lines. */
export function detectAiTxtFormat(text: string): AiTxtFormat {
  const t = text.replace(LEADING_BOM, '').trimStart();
  if (
    (t.startsWith('---') || MARKDOWN_HEADING_LINE_MULTILINE.test(t)) &&
    !USER_AGENT_DIRECTIVE.test(t)
  ) {
    return 'markdown';
  }
  return 'spawning';
}

const SECTIONS = [
  'What We Offer',
  'What We Do Not Offer',
  'Guidance for AI Assistants',
];

/** The `key: value` pairs of a front matter block. */
type FrontMatter = Partial<Record<string, string>>;

/** Parses the `key: value` pairs of a front matter block. */
function parseFrontMatter(block: string[]): FrontMatter {
  return Object.fromEntries(
    block.flatMap((l) => {
      const m = KEY_VALUE_LINE.exec(l);
      return m
        ? [[m[1].toLowerCase(), m[2].trim().replaceAll(/^["']|["']$/gu, '')]]
        : [];
    }),
  );
}

/** Checks the `updated` and `scope` fields of a closed front matter block. */
function frontMatterIssues(block: string[]): FileIssue[] {
  const meta = parseFrontMatter(block);
  const updated = meta.updated;
  const issues: (FileIssue | false)[] = [
    updated === undefined && {
      severity: 'error',
      line: 1,
      message: "The front matter needs an 'updated' date.",
    },
    updated !== undefined &&
      (!ISO_DATE.test(updated) || Number.isNaN(Date.parse(updated))) && {
        severity: 'error',
        line: 1,
        message: `'updated' must be a YYYY-MM-DD date, not '${updated}'.`,
      },
    !meta.scope && {
      severity: 'error',
      line: 1,
      message: "The front matter needs a 'scope'.",
    },
  ];
  return issues.filter((issue) => issue !== false);
}

/** Validates an aitxt.ing Markdown + YAML front matter file. */
function validateMarkdownAiTxt(text: string): FileIssue[] {
  const lines = splitLines(text);
  const hasFrontMatter = lines[0]?.trim() === '---';
  const end = hasFrontMatter
    ? lines.findIndex((l, index) => index > 0 && l.trim() === '---')
    : -1;
  const bodyStart = hasFrontMatter && end !== -1 ? end + 1 : 0;
  const closedFrontMatter: FileIssue[] =
    end === -1
      ? [
          {
            severity: 'error',
            line: 1,
            message: 'The front matter is never closed with ---.',
          },
        ]
      : frontMatterIssues(lines.slice(1, end));
  const frontMatter: FileIssue[] = hasFrontMatter
    ? closedFrontMatter
    : [
        {
          severity: 'error',
          line: 1,
          message:
            "The file needs YAML front matter with 'updated' and 'scope'.",
        },
      ];
  const body = lines.slice(bodyStart);
  const headings = new Set(
    body
      .filter((l) => H2_HEADING_PREFIX.test(l))
      .map((l) => l.replace(H2_HEADING_MARKER, '').trim().toLowerCase()),
  );
  return [
    ...frontMatter,
    ...(body.some((l) => H1_HEADING.test(l))
      ? []
      : [
          {
            severity: 'error' as const,
            message: 'The file must contain an H1 title.',
          },
        ]),
    ...SECTIONS.flatMap((section) =>
      headings.has(section.toLowerCase())
        ? []
        : [
            {
              severity: 'warning' as const,
              message: `The expected section '${section}' is missing.`,
            },
          ],
    ),
  ];
}

/** Media type tokens of the Spawning ai.txt syntax. */
const TOKENS = new Set(['*', 'images', 'audio', 'video', 'text', 'code']);

/** Lists a warning for every unknown media type token of an Allow or Disallow rule. */
function unknownTokenMessages(value: string): string[] {
  return value
    .split(WHITESPACE_OR_COMMA_RUN)
    .flatMap((token) =>
      token === '' ||
      TOKENS.has(token.toLowerCase()) ||
      PATH_OR_EXTENSION_PATTERN.test(token)
        ? []
        : [`Unknown media type token '${token}'.`],
    );
}

/** A non-empty line of a Spawning ai.txt file split into its parts. */
interface SpawningLine {
  raw: string;
  line: number;
  /** The text before the first `#`, trimmed. */
  content: string;
  /** Where the key ends; below 1 when the line has no key. */
  colon: number;
  rawKey: string;
  key: string;
  value: string;
}

/** Splits one line of a Spawning ai.txt file into its parts. */
function splitSpawningLine(raw: string, line: number): SpawningLine {
  const content = raw.split('#', 1)[0].trim();
  const colon = content.indexOf(':');
  const rawKey = content.slice(0, colon).trim();
  return {
    raw,
    line,
    content,
    colon,
    rawKey,
    key: rawKey.toLowerCase(),
    value: content.slice(colon + 1).trim(),
  };
}

/** Validates one non-empty line of a Spawning ai.txt file. */
function validateSpawningLine(
  { raw, line, colon, rawKey, key, value }: SpawningLine,
  hasAgent: boolean,
): FileIssue[] {
  const at = (severity: FileIssue['severity'], message: string): FileIssue => ({
    severity,
    message,
    line,
    snippet: raw.trim(),
  });
  if (colon < 1) {
    return [at('error', "Invalid line, expected 'Key: value'.")];
  }
  if (!['user-agent', 'allow', 'disallow', 'sitemap'].includes(key)) {
    const near = key.replaceAll(/[\s_]+/gu, '-');
    return [
      at(
        'error',
        ['user-agent'].includes(near)
          ? `Malformed key '${rawKey}', use 'User-Agent'.`
          : `Unknown key '${rawKey}'.`,
      ),
    ];
  }
  const isRule = key === 'allow' || key === 'disallow';
  const issues: (FileIssue | false)[] = [
    (rawKey !== rawKey.trim() || WHITESPACE_CHAR.test(rawKey)) &&
      at('error', `Malformed key '${rawKey}'.`),
    key === 'sitemap' &&
      !isAbsoluteUrl(value) &&
      at('error', `The Sitemap '${value}' is not an absolute http(s) URL.`),
    isRule &&
      !hasAgent &&
      at('error', `'${rawKey}' appears before any User-Agent line.`),
    ...(isRule
      ? unknownTokenMessages(value).map((message) => at('warning', message))
      : []),
  ];
  return issues.filter((issue) => issue !== false);
}

/** Validates a Spawning robots-style ai.txt file. */
function validateSpawningAiTxt(text: string): FileIssue[] {
  const entries = splitLines(text)
    .map((raw, index) => splitSpawningLine(raw, index + 1))
    .filter((entry) => entry.content !== '');
  const isAgent = (entry: SpawningLine): boolean =>
    entry.colon >= 1 && entry.key === 'user-agent';
  const hasAgent = entries.some((entry) => isAgent(entry));
  const hasRule = entries.some(
    (entry) =>
      entry.colon >= 1 && (entry.key === 'allow' || entry.key === 'disallow'),
  );
  return [
    ...entries.flatMap((entry, index) =>
      validateSpawningLine(
        entry,
        entries.slice(0, index).some((earlier) => isAgent(earlier)),
      ),
    ),
    ...(hasAgent && !hasRule
      ? [
          {
            severity: 'warning' as const,
            message: 'The file has no Allow or Disallow rules.',
          },
        ]
      : []),
    ...(hasAgent
      ? []
      : [
          {
            severity: 'error' as const,
            message: 'The file has no User-Agent line.',
          },
        ]),
  ];
}

/** The detected format of an ai.txt file and its issues. */
export interface AiTxtResult {
  format: AiTxtFormat;
  issues: FileIssue[];
}

/** Validates an ai.txt file, whichever format it uses. */
export function validateAiTxt(text: string): AiTxtResult {
  if (text.trim() === '') {
    return {
      format: 'spawning',
      issues: [{ severity: 'error', message: 'The file is empty.' }],
    };
  }
  const format = detectAiTxtFormat(text);
  return {
    format,
    issues:
      format === 'markdown'
        ? validateMarkdownAiTxt(text)
        : validateSpawningAiTxt(text),
  };
}
