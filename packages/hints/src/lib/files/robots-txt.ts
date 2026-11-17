import { isAbsoluteUrl, splitLines } from './issue.js';
import type { FileIssue } from './issue.js';

/** Matches a leading slash or asterisk. */
const SLASH_OR_STAR_PREFIX = /^[/*]/u;

/** Matches a `key=value` pair of letters. */
const KEY_EQUALS_VALUE_PAIR = /^([a-z-]+)=([a-z]+)$/iu;

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
  const parts = value.split(',').map((part) => part.trim());
  const errors = parts.map((part, index) => {
    const pair = KEY_EQUALS_VALUE_PAIR.exec(part);
    if (!pair) {
      return `Invalid Content-Signal entry '${part}', expected name=yes or name=no.`;
    }
    const name = pair[1].toLowerCase();
    if (!SIGNALS.has(name)) {
      return `Unknown Content-Signal '${name}', expected search, ai-input or ai-train.`;
    }
    if (!['yes', 'no'].includes(pair[2].toLowerCase())) {
      return `Content-Signal '${name}' must be yes or no, not '${pair[2]}'.`;
    }
    const repeated = parts
      .slice(0, index)
      .some(
        (earlier) =>
          KEY_EQUALS_VALUE_PAIR.exec(earlier)?.[1].toLowerCase() === name,
      );
    return repeated
      ? `Content-Signal '${name}' is given more than once.`
      : null;
  });
  return errors.find((error) => error !== null) ?? null;
}

interface Group {
  agents: readonly string[];
  line: number;
  hasSignal: boolean;
  rules: readonly { kind: string; value: string }[];
}

/**
 * The running state of the line scan of a robots.txt file. The group being
 * read is always the last of `groups`.
 */
interface ParseState {
  groups: readonly Group[];
  /** True while the current group has only seen User-agent lines so far. */
  collectingAgents: boolean;
  anySignal: boolean;
}

/** The scan state after a line and the findings that line caused. */
interface ScanStep {
  state: ParseState;
  issues: FileIssue[];
}

/** Applies one directive of a robots.txt file to the scan state. */
function applyDirective(
  state: ParseState,
  key: string,
  value: string,
  line: number,
  at: (severity: FileIssue['severity'], message: string) => FileIssue,
): ScanStep {
  const current = state.groups.at(-1);
  switch (key) {
    case 'user-agent': {
      const issues = [
        ...(value === ''
          ? [at('error', 'User-agent needs a product token or *.')]
          : []),
      ];
      // A User-agent after a rule starts a new group.
      const groups =
        current && state.collectingAgents
          ? state.groups.with(-1, {
              ...current,
              agents: [...current.agents, value.toLowerCase()],
            })
          : [
              ...state.groups,
              {
                agents: [value.toLowerCase()],
                line,
                hasSignal: false,
                rules: [],
              },
            ];
      return { state: { ...state, groups, collectingAgents: true }, issues };
    }
    case 'allow':
    case 'disallow': {
      if (!current) {
        return {
          state,
          issues: [at('error', `'${key}' appears before any User-agent line.`)],
        };
      }
      return {
        state: {
          ...state,
          collectingAgents: false,
          groups: state.groups.with(-1, {
            ...current,
            rules: [...current.rules, { kind: key, value }],
          }),
        },
        issues:
          value !== '' && !SLASH_OR_STAR_PREFIX.test(value)
            ? [at('error', `The ${key} path '${value}' must start with '/'.`)]
            : [],
      };
    }
    case 'sitemap': {
      return {
        state,
        issues: isAbsoluteUrl(value)
          ? []
          : [
              at(
                'error',
                `The Sitemap '${value}' is not an absolute http(s) URL.`,
              ),
            ],
      };
    }
    case 'content-signal': {
      const problem = validateContentSignal(value);
      const issues = [
        ...(problem ? [at('error', problem)] : []),
        ...(current
          ? []
          : [
              at(
                'warning',
                'Content-Signal appears before any User-agent line, so no group carries it.',
              ),
            ]),
      ];
      return {
        state: {
          anySignal: true,
          collectingAgents: current ? false : state.collectingAgents,
          groups: current
            ? state.groups.with(-1, { ...current, hasSignal: true })
            : state.groups,
        },
        issues,
      };
    }
    default: {
      return {
        state: current ? { ...state, collectingAgents: false } : state,
        issues: [],
      };
    }
  }
}

/** Scans one line of a robots.txt file, ignoring blanks and comments. */
function processLine(state: ParseState, raw: string, line: number): ScanStep {
  const content = raw.split('#', 1)[0].trim();
  if (content === '') {
    return { state, issues: [] };
  }
  const at = (severity: FileIssue['severity'], message: string): FileIssue => ({
    severity,
    message,
    line,
    snippet: raw.trim(),
  });
  const colon = content.indexOf(':');
  if (colon < 1) {
    return {
      state,
      issues: [at('error', "Invalid line, expected 'directive: value'.")],
    };
  }
  const key = content.slice(0, colon).trim().toLowerCase();
  const value = content.slice(colon + 1).trim();
  return KNOWN.has(key)
    ? applyDirective(state, key, value, line, at)
    : { state, issues: [at('warning', `Unknown directive '${key}'.`)] };
}

/** Validates the text of a robots.txt file against RFC 9309. */
export function validateRobotsTxt(text: string): FileIssue[] {
  const oversized: FileIssue[] =
    Buffer.byteLength(text, 'utf8') > ROBOTS_MAX_BYTES
      ? [
          {
            severity: 'warning',
            message: `The file is larger than 500 KiB; crawlers may ignore the rest.`,
          },
        ]
      : [];
  if (text.trim() === '') {
    return [
      ...oversized,
      {
        severity: 'warning',
        message: 'The file is empty, which allows all crawling.',
      },
    ];
  }
  const scan = splitLines(text).reduce<ScanStep>(
    (previous, raw, index) => {
      const step = processLine(previous.state, raw, index + 1);
      return {
        state: step.state,
        issues: [...previous.issues, ...step.issues],
      };
    },
    {
      state: { groups: [], collectingAgents: false, anySignal: false },
      issues: [],
    },
  );
  const { groups, anySignal } = scan.state;
  return [
    ...oversized,
    ...scan.issues,
    ...(groups.length === 0
      ? [
          {
            severity: 'warning' as const,
            message:
              'The file has no User-agent group, so its rules do nothing.',
          },
        ]
      : []),
    ...groups.flatMap((group): FileIssue[] => [
      // A crawler reads only its most specific group, so each must repeat it.
      ...(anySignal && !group.hasSignal
        ? [
            {
              severity: 'warning' as const,
              line: group.line,
              message: `The group for '${group.agents.join(', ')}' has no Content-Signal; crawlers read only their most specific group, so repeat it in every group.`,
            },
          ]
        : []),
      ...(group.agents.includes('*') &&
      group.rules.some((r) => r.kind === 'disallow' && r.value === '/')
        ? [
            {
              severity: 'warning' as const,
              line: group.line,
              message:
                "'Disallow: /' for all user agents blocks the whole site from crawlers; make sure this is intended.",
            },
          ]
        : []),
    ]),
  ];
}
