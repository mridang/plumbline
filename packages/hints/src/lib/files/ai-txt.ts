import { isAbsoluteUrl, splitLines, type FileIssue } from './issue.js';

/** Matches a file extension glob or a path. */
const PATH_OR_EXTENSION_PATTERN = /^(\*?\.\w+|\/\S*|\*\.\w+)$/;

/** Matches a run of whitespace or commas. */
const WHITESPACE_OR_COMMA_RUN = /[\s,]+/;

/** Matches a single whitespace character. */
const WHITESPACE_CHAR = /\s/;

/** Matches the level-two Markdown heading marker and its spacing. */
const H2_HEADING_MARKER = /^##\s+/;

/** Matches a level-two Markdown heading prefix. */
const H2_HEADING_PREFIX = /^##\s/;

/** Matches a level-one Markdown heading with text. */
const H1_HEADING = /^#\s+\S/;

/** Matches an ISO `YYYY-MM-DD` date. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Matches a `Key: value` line. */
const KEY_VALUE_LINE = /^([A-Za-z_-]+)\s*:(.*)$/;

/** Matches a robots-style `User-agent:` directive line. */
const USER_AGENT_DIRECTIVE = /^user-agent\s*:/im;

/** Matches a Markdown heading line anywhere in the text. */
const MARKDOWN_HEADING_LINE_MULTILINE = /^#\s/m;

/** Matches a leading byte order mark. */
const LEADING_BOM = /^\uFEFF/;

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

/** Parses the `key: value` pairs of a front matter block. */
function parseFrontMatter(block: string[]): Partial<Record<string, string>> {
  const meta: Partial<Record<string, string>> = {};
  for (const l of block) {
    const m = KEY_VALUE_LINE.exec(l);
    if (m) {
      meta[m[1].toLowerCase()] = m[2].trim().replaceAll(/^["']|["']$/g, '');
    }
  }
  return meta;
}

/** Checks the `updated` and `scope` fields of a closed front matter block. */
function frontMatterIssues(block: string[]): FileIssue[] {
  const issues: FileIssue[] = [];
  const meta = parseFrontMatter(block);
  const updated = meta['updated'];
  if (updated === undefined) {
    issues.push({
      severity: 'error',
      line: 1,
      message: "The front matter needs an 'updated' date.",
    });
  } else if (!ISO_DATE.test(updated) || Number.isNaN(Date.parse(updated))) {
    issues.push({
      severity: 'error',
      line: 1,
      message: `'updated' must be a YYYY-MM-DD date, not '${updated}'.`,
    });
  } else {
    // A well-formed 'updated' date needs no finding.
  }
  if (!meta['scope']) {
    issues.push({
      severity: 'error',
      line: 1,
      message: "The front matter needs a 'scope'.",
    });
  }
  return issues;
}

/** Validates an aitxt.ing Markdown + YAML front matter file. */
function validateMarkdownAiTxt(text: string): FileIssue[] {
  const issues: FileIssue[] = [];
  const lines = splitLines(text);
  let bodyStart = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, index) => index > 0 && l.trim() === '---');
    if (end === -1) {
      issues.push({
        severity: 'error',
        line: 1,
        message: 'The front matter is never closed with ---.',
      });
    } else {
      bodyStart = end + 1;
      issues.push(...frontMatterIssues(lines.slice(1, end)));
    }
  } else {
    issues.push({
      severity: 'error',
      line: 1,
      message: "The file needs YAML front matter with 'updated' and 'scope'.",
    });
  }
  const body = lines.slice(bodyStart);
  if (!body.some((l) => H1_HEADING.test(l))) {
    issues.push({
      severity: 'error',
      message: 'The file must contain an H1 title.',
    });
  }
  const headings = new Set(
    body
      .filter((l) => H2_HEADING_PREFIX.test(l))
      .map((l) => l.replace(H2_HEADING_MARKER, '').trim().toLowerCase()),
  );
  for (const section of SECTIONS) {
    if (!headings.has(section.toLowerCase())) {
      issues.push({
        severity: 'warning',
        message: `The expected section '${section}' is missing.`,
      });
    }
  }
  return issues;
}

/** Media type tokens of the Spawning ai.txt syntax. */
const TOKENS = new Set(['*', 'images', 'audio', 'video', 'text', 'code']);

/** Tracks which directives a Spawning ai.txt file has declared so far. */
interface SpawningState {
  hasAgent: boolean;
  hasRule: boolean;
}

/** Warns about every unknown media type token of an Allow or Disallow rule. */
function checkTokens(value: string, warn: (message: string) => number): void {
  const tokens = value.split(WHITESPACE_OR_COMMA_RUN).filter(Boolean);
  for (const token of tokens) {
    if (
      !TOKENS.has(token.toLowerCase()) &&
      !PATH_OR_EXTENSION_PATTERN.test(token)
    ) {
      warn(`Unknown media type token '${token}'.`);
    }
  }
}

/** Validates one non-empty line of a Spawning ai.txt file. */
function validateSpawningLine(
  raw: string,
  line: number,
  state: SpawningState,
  issues: FileIssue[],
): void {
  const content = raw.split('#', 1)[0].trim();
  const at = (severity: FileIssue['severity'], message: string) =>
    issues.push({ severity, message, line, snippet: raw.trim() });
  const colon = content.indexOf(':');
  if (colon < 1) {
    at('error', "Invalid line, expected 'Key: value'.");
    return;
  }
  const rawKey = content.slice(0, colon).trim();
  const value = content.slice(colon + 1).trim();
  const key = rawKey.toLowerCase();
  if (!['user-agent', 'allow', 'disallow', 'sitemap'].includes(key)) {
    const near = key.replaceAll(/[\s_]+/g, '-');
    at(
      'error',
      ['user-agent'].includes(near)
        ? `Malformed key '${rawKey}', use 'User-Agent'.`
        : `Unknown key '${rawKey}'.`,
    );
    return;
  }
  if (rawKey !== rawKey.trim() || WHITESPACE_CHAR.test(rawKey)) {
    at('error', `Malformed key '${rawKey}'.`);
  }
  if (key === 'user-agent') {
    state.hasAgent = true;
  } else if (key === 'sitemap') {
    if (!isAbsoluteUrl(value)) {
      at('error', `The Sitemap '${value}' is not an absolute http(s) URL.`);
    }
  } else {
    if (!state.hasAgent) {
      at('error', `'${rawKey}' appears before any User-Agent line.`);
    }
    state.hasRule = true;
    checkTokens(value, (message) => at('warning', message));
  }
}

/** Validates a Spawning robots-style ai.txt file. */
function validateSpawningAiTxt(text: string): FileIssue[] {
  const issues: FileIssue[] = [];
  const state: SpawningState = { hasAgent: false, hasRule: false };
  for (const [index, raw] of splitLines(text).entries()) {
    if (raw.split('#', 1)[0].trim() !== '') {
      validateSpawningLine(raw, index + 1, state, issues);
    }
  }
  if (state.hasAgent) {
    if (!state.hasRule) {
      issues.push({
        severity: 'warning',
        message: 'The file has no Allow or Disallow rules.',
      });
    }
  } else {
    issues.push({
      severity: 'error',
      message: 'The file has no User-Agent line.',
    });
  }
  return issues;
}

/** Validates an ai.txt file, whichever format it uses. */
export function validateAiTxt(text: string): {
  format: AiTxtFormat;
  issues: FileIssue[];
} {
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
