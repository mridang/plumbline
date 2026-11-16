import { isAbsoluteUrl, splitLines, type FileIssue } from './issue.js';

/** Matches a leading slash or asterisk. */
const SLASH_OR_STAR_PREFIX = /^[/*]/;

/** Matches a `key=value` pair of letters. */
const KEY_EQUALS_VALUE_PAIR = /^([a-z-]+)=([a-z]+)$/i;

/** RFC 9309 section 2.5: parsers must handle at least 500 KiB. */
const ROBOTS_MAX_BYTES = 500 * 1024;

/** Directives defined by RFC 9309 and the common, widely honoured ones. */
const KNOWN = new Set([
  'user-agent',
  'allow',
  'disallow',
  'sitemap',
  'content-signal',
  'crawl-delay',
  'host',
  'clean-param',
]);

const SIGNALS = new Set(['search', 'ai-input', 'ai-train']);

/** Validates a Content-Signal value such as `search=yes, ai-train=no`. */
export function validateContentSignal(value: string): string | null {
  if (value.trim() === '') {
    return 'The Content-Signal value is empty.';
  }
  const seen = new Set<string>();
  for (const part of value.split(',')) {
    const pair = KEY_EQUALS_VALUE_PAIR.exec(part.trim());
    if (!pair) {
      return `Invalid Content-Signal entry '${part.trim()}', expected name=yes or name=no.`;
    }
    const name = pair[1].toLowerCase();
    if (!SIGNALS.has(name)) {
      return `Unknown Content-Signal '${name}', expected search, ai-input or ai-train.`;
    }
    if (!['yes', 'no'].includes(pair[2].toLowerCase())) {
      return `Content-Signal '${name}' must be yes or no, not '${pair[2]}'.`;
    }
    if (seen.has(name)) {
      return `Content-Signal '${name}' is given more than once.`;
    }
    seen.add(name);
  }
  return null;
}

interface Group {
  agents: string[];
  line: number;
  hasSignal: boolean;
  rules: { kind: string; value: string }[];
}

/** The running state of the line scan of a robots.txt file. */
interface ParseState {
  groups: Group[];
  current: Group | null;
  /** True while the current group has only seen User-agent lines so far. */
  collectingAgents: boolean;
  anySignal: boolean;
}

/** Applies one directive of a robots.txt file to the scan state. */
function applyDirective(
  state: ParseState,
  key: string,
  value: string,
  line: number,
  at: (severity: FileIssue['severity'], message: string) => number,
): void {
  switch (key) {
    case 'user-agent': {
      if (value === '') {
        at('error', 'User-agent needs a product token or *.');
      }
      // A User-agent after a rule starts a new group.
      if (!state.current || !state.collectingAgents) {
        state.current = { agents: [], line, hasSignal: false, rules: [] };
        state.groups.push(state.current);
      }
      state.current.agents.push(value.toLowerCase());
      state.collectingAgents = true;
      break;
    }
    case 'allow':
    case 'disallow': {
      if (!state.current) {
        at('error', `'${key}' appears before any User-agent line.`);
        break;
      }
      state.collectingAgents = false;
      if (value !== '' && !SLASH_OR_STAR_PREFIX.test(value)) {
        at('error', `The ${key} path '${value}' must start with '/'.`);
      }
      state.current.rules.push({ kind: key, value });
      break;
    }
    case 'sitemap': {
      if (!isAbsoluteUrl(value)) {
        at('error', `The Sitemap '${value}' is not an absolute http(s) URL.`);
      }
      break;
    }
    case 'content-signal': {
      state.anySignal = true;
      const problem = validateContentSignal(value);
      if (problem) {
        at('error', problem);
      }
      if (state.current) {
        state.current.hasSignal = true;
        state.collectingAgents = false;
      } else {
        at(
          'warning',
          'Content-Signal appears before any User-agent line, so no group carries it.',
        );
      }
      break;
    }
    default: {
      if (state.current) {
        state.collectingAgents = false;
      }
    }
  }
}

/** Scans one line of a robots.txt file, ignoring blanks and comments. */
function processLine(
  state: ParseState,
  raw: string,
  line: number,
  issues: FileIssue[],
): void {
  const content = raw.split('#', 1)[0].trim();
  if (content === '') {
    return;
  }
  const at = (severity: FileIssue['severity'], message: string) =>
    issues.push({ severity, message, line, snippet: raw.trim() });
  const colon = content.indexOf(':');
  if (colon < 1) {
    at('error', "Invalid line, expected 'directive: value'.");
    return;
  }
  const key = content.slice(0, colon).trim().toLowerCase();
  const value = content.slice(colon + 1).trim();
  if (KNOWN.has(key)) {
    applyDirective(state, key, value, line, at);
  } else {
    at('warning', `Unknown directive '${key}'.`);
  }
}

/** Validates the text of a robots.txt file against RFC 9309. */
export function validateRobotsTxt(text: string): FileIssue[] {
  const issues: FileIssue[] = [];
  if (Buffer.byteLength(text, 'utf8') > ROBOTS_MAX_BYTES) {
    issues.push({
      severity: 'warning',
      message: `The file is larger than 500 KiB; crawlers may ignore the rest.`,
    });
  }
  if (text.trim() === '') {
    issues.push({
      severity: 'warning',
      message: 'The file is empty, which allows all crawling.',
    });
    return issues;
  }
  const state: ParseState = {
    groups: [],
    current: null,
    collectingAgents: false,
    anySignal: false,
  };
  for (const [index, raw] of splitLines(text).entries()) {
    processLine(state, raw, index + 1, issues);
  }
  const { groups, anySignal } = state;
  if (groups.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'The file has no User-agent group, so its rules do nothing.',
    });
  }
  for (const group of groups) {
    // A crawler reads only its most specific group, so each must repeat it.
    if (anySignal && !group.hasSignal) {
      issues.push({
        severity: 'warning',
        line: group.line,
        message: `The group for '${group.agents.join(', ')}' has no Content-Signal; crawlers read only their most specific group, so repeat it in every group.`,
      });
    }
    if (
      group.agents.includes('*') &&
      group.rules.some((r) => r.kind === 'disallow' && r.value === '/')
    ) {
      issues.push({
        severity: 'warning',
        line: group.line,
        message:
          "'Disallow: /' for all user agents blocks the whole site from crawlers; make sure this is intended.",
      });
    }
  }
  return issues;
}
