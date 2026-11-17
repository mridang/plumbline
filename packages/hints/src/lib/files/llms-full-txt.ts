import { splitLines } from './issue.js';
import type { FileIssue } from './issue.js';

/** Matches an ATX Markdown heading. */
const ATX_HEADING = /^(#{1,6})(?:\s+(\S.*))?$/u;

/** Matches an opening Markdown code fence. */
const CODE_FENCE_OPEN = /^(`{3,}|~{3,})/u;

/** Llmstxtvalidator.dev warns above 500 KB. */
const LLMS_FULL_WARN_BYTES = 500 * 1000;

/** The running state of the line scan of an llms-full.txt file. */
interface ScanState {
  fence: { marker: string; line: number } | null;
  h1: number;
  previous: number;
  body: number;
}

/** The scan state after a line and the findings that line caused. */
interface ScanStep {
  state: ScanState;
  issues: FileIssue[];
}

/** Records an ATX heading and the findings it causes. */
function scanHeading(
  state: ScanState,
  match: RegExpExecArray,
  line: number,
  t: string,
): ScanStep {
  const level = match[1].length;
  const h1 = level === 1 ? state.h1 + 1 : state.h1;
  const issues: (FileIssue | false)[] = [
    !match[2] && {
      severity: 'error',
      line,
      snippet: t,
      message: 'The heading is empty.',
    },
    level === 1 &&
      h1 === 2 && {
        severity: 'warning',
        line,
        snippet: t,
        message: 'The file has more than one H1.',
      },
    state.previous > 0 &&
      level > state.previous + 1 && {
        severity: 'warning',
        line,
        snippet: t,
        message: `The heading jumps from H${state.previous} to H${level}.`,
      },
  ];
  return {
    state: { ...state, h1, previous: level },
    issues: issues.filter((issue) => issue !== false),
  };
}

/** Scans one line, tracking code fences, headings and content lines. */
function scanLine(state: ScanState, raw: string, line: number): ScanStep {
  const t = raw.trim();
  const fenceMatch = CODE_FENCE_OPEN.exec(t);
  if (fenceMatch) {
    // A fence of another marker inside a fence is just content.
    const closes =
      state.fence !== null && fenceMatch[1].startsWith(state.fence.marker);
    const fence = state.fence ?? { marker: fenceMatch[1][0], line };
    return {
      state: { ...state, fence: closes ? null : fence, body: state.body + 1 },
      issues: [],
    };
  }
  const heading = state.fence ? null : ATX_HEADING.exec(t);
  if (heading) {
    return scanHeading(state, heading, line, t);
  }
  // A blank line outside a fence is neither a heading nor content.
  return {
    state: state.fence || t !== '' ? { ...state, body: state.body + 1 } : state,
    issues: [],
  };
}

/** Whole kilobytes without digit grouping, as the message has always read. */
const KILOBYTES = new Intl.NumberFormat('en', {
  maximumFractionDigits: 0,
  useGrouping: false,
});

/** Validates an llms-full.txt file: markdown with an H1 that parses. */
export function validateLlmsFullTxt(text: string): FileIssue[] {
  if (text.trim() === '') {
    return [{ severity: 'error', message: 'The file is empty.' }];
  }
  const size = Buffer.byteLength(text, 'utf8');
  const scan = splitLines(text).reduce<ScanStep>(
    (previous, raw, index) => {
      const step = scanLine(previous.state, raw, index + 1);
      return {
        state: step.state,
        issues: [...previous.issues, ...step.issues],
      };
    },
    { state: { fence: null, h1: 0, previous: 0, body: 0 }, issues: [] },
  );
  const { state } = scan;
  const issues: (FileIssue | false)[] = [
    size > LLMS_FULL_WARN_BYTES && {
      severity: 'warning',
      message: `The file is ${KILOBYTES.format(size / 1000)} KB, above the 500 KB the validator warns at; it may exceed AI context limits.`,
    },
    ...scan.issues,
    state.fence !== null && {
      severity: 'error',
      line: state.fence.line,
      message: 'A code fence is never closed.',
    },
    state.h1 === 0 && {
      severity: 'error',
      message: 'The file must contain an H1 title.',
    },
    state.body === 0 && {
      severity: 'error',
      message: 'The file has headings but no content.',
    },
  ];
  return issues.filter((issue) => issue !== false);
}
