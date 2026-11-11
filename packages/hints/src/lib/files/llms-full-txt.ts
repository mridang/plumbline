import { splitLines, type FileIssue } from './issue.js';

/** Llmstxtvalidator.dev warns above 500 KB. */
const LLMS_FULL_WARN_BYTES = 500 * 1000;

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
  let fence: { marker: string; line: number } | null = null;
  let h1 = 0;
  let previous = 0;
  let body = 0;
  splitLines(text).forEach((raw, i) => {
    const line = i + 1;
    const t = raw.trim();
    const f = /^(`{3,}|~{3,})/.exec(t);
    if (f) {
      if (!fence) {
        fence = { marker: f[1][0], line };
      } else if (f[1][0] === fence.marker) {
        fence = null;
      } else {
        // A fence of another marker inside a fence is just content.
      }
      body += 1;
      return;
    }
    if (fence) {
      body += 1;
      return;
    }
    const h = /^(#{1,6})(?:\s+(\S.*))?$/.exec(t);
    if (h) {
      const level = h[1].length;
      if (!h[2]) {
        issues.push({
          severity: 'error',
          line,
          snippet: t,
          message: 'The heading is empty.',
        });
      }
      if (level === 1) {
        h1 += 1;
        if (h1 === 2) {
          issues.push({
            severity: 'warning',
            line,
            snippet: t,
            message: 'The file has more than one H1.',
          });
        }
      }
      if (previous > 0 && level > previous + 1) {
        issues.push({
          severity: 'warning',
          line,
          snippet: t,
          message: `The heading jumps from H${previous} to H${level}.`,
        });
      }
      previous = level;
    } else if (t === '') {
      // A blank line is neither a heading nor content.
    } else {
      body += 1;
    }
  });
  if (fence) {
    issues.push({
      severity: 'error',
      line: (fence as { line: number }).line,
      message: 'A code fence is never closed.',
    });
  }
  if (h1 === 0) {
    issues.push({
      severity: 'error',
      message: 'The file must contain an H1 title.',
    });
  }
  if (body === 0) {
    issues.push({
      severity: 'error',
      message: 'The file has headings but no content.',
    });
  }
  return issues;
}
