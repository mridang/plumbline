import { splitLines, type FileIssue } from './issue.js';

/** Matches an ATX Markdown heading. */
const ATX_HEADING = /^(#{1,6})(?:\s+(\S.*))?$/;

/** Matches an opening Markdown code fence. */
const CODE_FENCE_OPEN = /^(`{3,}|~{3,})/;

/** Llmstxtvalidator.dev warns above 500 KB. */
const LLMS_FULL_WARN_BYTES = 500 * 1000;

/** The running state of the line scan of an llms-full.txt file. */
interface ScanState {
  fence: { marker: string; line: number } | null;
  h1: number;
  previous: number;
  body: number;
}

/** Records an ATX heading and the findings it causes. */
function scanHeading(
  state: ScanState,
  match: RegExpExecArray,
  line: number,
  t: string,
  issues: FileIssue[],
): void {
  const level = match[1].length;
  if (!match[2]) {
    issues.push({
      severity: 'error',
      line,
      snippet: t,
      message: 'The heading is empty.',
    });
  }
  if (level === 1) {
    state.h1 += 1;
    if (state.h1 === 2) {
      issues.push({
        severity: 'warning',
        line,
        snippet: t,
        message: 'The file has more than one H1.',
      });
    }
  }
  if (state.previous > 0 && level > state.previous + 1) {
    issues.push({
      severity: 'warning',
      line,
      snippet: t,
      message: `The heading jumps from H${state.previous} to H${level}.`,
    });
  }
  state.previous = level;
}

/** Scans one line, tracking code fences, headings and content lines. */
function scanLine(
  state: ScanState,
  raw: string,
  line: number,
  issues: FileIssue[],
): void {
  const t = raw.trim();
  const fenceMatch = CODE_FENCE_OPEN.exec(t);
  if (fenceMatch) {
    if (!state.fence) {
      state.fence = { marker: fenceMatch[1][0], line };
    } else if (fenceMatch[1][0] === state.fence.marker) {
      state.fence = null;
    } else {
      // A fence of another marker inside a fence is just content.
    }
    state.body += 1;
    return;
  }
  const heading = state.fence ? null : ATX_HEADING.exec(t);
  if (heading) {
    scanHeading(state, heading, line, t, issues);
  } else if (state.fence || t !== '') {
    state.body += 1;
  } else {
    // A blank line is neither a heading nor content.
  }
}

/** Validates an llms-full.txt file: markdown with an H1 that parses. */
export function validateLlmsFullTxt(text: string): FileIssue[] {
  const issues: FileIssue[] = [];
  if (text.trim() === '') {
    return [{ severity: 'error', message: 'The file is empty.' }];
  }
  const size = Buffer.byteLength(text, 'utf8');
  if (size > LLMS_FULL_WARN_BYTES) {
    issues.push({
      severity: 'warning',
      message: `The file is ${(size / 1000).toFixed(0)} KB, above the 500 KB the validator warns at; it may exceed AI context limits.`,
    });
  }
  const state: ScanState = { fence: null, h1: 0, previous: 0, body: 0 };
  for (const [index, raw] of splitLines(text).entries()) {
    scanLine(state, raw, index + 1, issues);
  }
  if (state.fence) {
    issues.push({
      severity: 'error',
      line: state.fence.line,
      message: 'A code fence is never closed.',
    });
  }
  if (state.h1 === 0) {
    issues.push({
      severity: 'error',
      message: 'The file must contain an H1 title.',
    });
  }
  if (state.body === 0) {
    issues.push({
      severity: 'error',
      message: 'The file has headings but no content.',
    });
  }
  return issues;
}
