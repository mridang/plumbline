import { isAbsoluteUrl, splitLines } from './issue.js';
import type { FileIssue } from './issue.js';

/** Matches a Markdown list item marker. */
const LIST_ITEM_PREFIX = /^[-*]\s/u;

/** Matches a heading of level three to six. */
const DEEP_HEADING_PREFIX = /^#{3,6}\s/u;

/** Matches the level-two Markdown heading marker and its spacing. */
const H2_HEADING_MARKER = /^##\s+/u;

/** Matches a level-two Markdown heading prefix. */
const H2_HEADING_PREFIX = /^##\s/u;

/** Matches a level-one Markdown heading prefix. */
const H1_HEADING_PREFIX = /^#\s/u;

/** Matches a Markdown code fence marker. */
const CODE_FENCE_PREFIX = /^(```|~~~)/u;

/** Matches a Markdown blockquote line with content. */
const BLOCKQUOTE_LINE = /^>\s*\S/u;

/** Matches a level-one Markdown heading with text. */
const H1_HEADING = /^#\s+\S/u;

/** Matches `- [name](url)` with an optional `: description`. */
const LINK_ITEM = /^[-*]\s+\[([^\]]+)\]\(([^)\s]*)\)\s*(?::(.*))?$/u;

/** What the line scan has found so far. */
interface ScanState {
  inFence: boolean;
  /** The link URLs seen so far, to report a repeat. */
  urls: readonly string[];
  /** The lower-cased section names seen so far, to report a repeat. */
  names: readonly string[];
  /** How many list items were links. */
  links: number;
  /** The section being read, with its number of link items. */
  section: { name: string; line: number; items: number } | null;
}

/** The scan state after a line and the findings that line caused. */
interface ScanStep {
  state: ScanState;
  issues: FileIssue[];
}

/** The outcome of checking one list item of a section. */
interface LinkItemCheck {
  isLink: boolean;
  urls: readonly string[];
  issues: FileIssue[];
}

/** Checks one list item of a section: its findings, and whether it is a link. */
function checkLinkItem(
  t: string,
  urls: readonly string[],
  at: (severity: FileIssue['severity'], message: string) => FileIssue,
): LinkItemCheck {
  const m = LINK_ITEM.exec(t);
  if (!m) {
    return {
      isLink: false,
      urls,
      issues: [
        at('error', "List items must be links: '- [name](url): description'."),
      ],
    };
  }
  const issues: (FileIssue | false)[] = [
    urls.includes(m[2]) &&
      at('warning', `The URL '${m[2]}' is listed more than once.`),
    // An absolute link that is not plain HTTP needs no finding.
    !isAbsoluteUrl(m[2]) &&
      at('error', `The link '${m[2]}' must be an absolute URL.`),
    isAbsoluteUrl(m[2]) &&
      m[2].startsWith('http:') &&
      at('warning', `The link '${m[2]}' should use HTTPS.`),
  ];
  return {
    isLink: true,
    urls: [...urls, m[2]],
    issues: issues.filter((issue) => issue !== false),
  };
}

/** Reports a section that ended without any link. */
function closeSection(section: ScanState['section']): FileIssue[] {
  return section?.items === 0
    ? [
        {
          severity: 'warning',
          line: section.line,
          message: `The section '${section.name}' has no links.`,
        },
      ]
    : [];
}

/** Scans one line, tracking fences, sections and their link items. */
function scanLine(
  state: ScanState,
  raw: string,
  index: number,
  first: number,
): ScanStep {
  const line = index + 1;
  const t = raw.trim();
  const at = (severity: FileIssue['severity'], message: string): FileIssue => ({
    severity,
    message,
    line,
    snippet: t,
  });
  if (CODE_FENCE_PREFIX.test(t)) {
    return { state: { ...state, inFence: !state.inFence }, issues: [] };
  }
  if (state.inFence) {
    // Fenced lines are content and are not checked here.
    return { state, issues: [] };
  }
  if (H1_HEADING_PREFIX.test(t) && index !== first) {
    return {
      state,
      issues: [at('error', 'The file must have only one H1 title.')],
    };
  }
  if (H2_HEADING_PREFIX.test(t)) {
    const name = t.replace(H2_HEADING_MARKER, '').trim();
    return {
      state: {
        ...state,
        names: [...state.names, name.toLowerCase()],
        section: { name, line, items: 0 },
      },
      issues: [
        ...closeSection(state.section),
        ...(state.names.includes(name.toLowerCase())
          ? [at('warning', `The section '${name}' is repeated.`)]
          : []),
      ],
    };
  }
  if (DEEP_HEADING_PREFIX.test(t)) {
    return {
      state,
      issues: [
        at(
          'warning',
          'Only H2 headings delimit sections; deeper headings are not part of the format.',
        ),
      ],
    };
  }
  if (state.section && LIST_ITEM_PREFIX.test(t)) {
    const item = checkLinkItem(t, state.urls, at);
    return {
      state: {
        ...state,
        urls: item.urls,
        links: item.isLink ? state.links + 1 : state.links,
        section: item.isLink
          ? { ...state.section, items: state.section.items + 1 }
          : state.section,
      },
      issues: item.issues,
    };
  }
  // Other lines are free text and are not checked here.
  return { state, issues: [] };
}

/** Validates an llms.txt file against the llmstxt.org format. */
export function validateLlmsTxt(text: string): FileIssue[] {
  const lines = splitLines(text);
  if (text.trim() === '') {
    return [{ severity: 'error', message: 'The file is empty.' }];
  }
  const first = lines.findIndex((l) => l.trim() !== '');
  const scan = lines.reduce<ScanStep>(
    (previous, raw, index) => {
      const step = scanLine(previous.state, raw, index, first);
      return {
        state: step.state,
        issues: [...previous.issues, ...step.issues],
      };
    },
    {
      state: { inFence: false, urls: [], names: [], links: 0, section: null },
      issues: [],
    },
  );
  const issues: (FileIssue | false)[] = [
    !H1_HEADING.test(lines[first]) && {
      severity: 'error',
      line: first + 1,
      snippet: lines[first],
      message: 'The file must start with an H1 title (# Name).',
    },
    // llmstxt.org makes the summary optional, but llmstxtvalidator.dev
    // requires it, so its absence is advice rather than an error.
    !lines.some((l) => BLOCKQUOTE_LINE.test(l)) && {
      severity: 'warning',
      message: 'The file has no blockquote summary (> ...) after the title.',
    },
    // The validator warns above 500 KB, where agents may truncate the file.
    Buffer.byteLength(text, 'utf8') > 500 * 1000 && {
      severity: 'warning',
      message:
        'The file is larger than 500 KB and may exceed AI context limits.',
    },
    ...scan.issues,
    ...closeSection(scan.state.section),
    scan.state.links === 0 && {
      severity: 'warning',
      message: 'The file has no H2 section with a list of links.',
    },
  ];
  return issues.filter((issue) => issue !== false);
}
