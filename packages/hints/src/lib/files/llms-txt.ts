import { isAbsoluteUrl, splitLines, type FileIssue } from './issue.js';

/** Matches `- [name](url)` with an optional `: description`. */
const LINK_ITEM = /^[-*]\s+\[([^\]]+)\]\(([^)\s]*)\)\s*(?::(.*))?$/;

/** Validates an llms.txt file against the llmstxt.org format. */
export function validateLlmsTxt(text: string): FileIssue[] {
  const issues: FileIssue[] = [];
  const lines = splitLines(text);
  if (text.trim() === '') {
    return [{ severity: 'error', message: 'The file is empty.' }];
  }
  const first = lines.findIndex((l) => l.trim() !== '');
  if (!/^#\s+\S/.test(lines[first])) {
    issues.push({
      severity: 'error',
      line: first + 1,
      snippet: lines[first],
      message: 'The file must start with an H1 title (# Name).',
    });
  }
  // llmstxt.org makes the summary optional, but llmstxtvalidator.dev
  // requires it, so its absence is advice rather than an error.
  if (!lines.some((l) => /^>\s*\S/.test(l))) {
    issues.push({
      severity: 'warning',
      message: 'The file has no blockquote summary (> ...) after the title.',
    });
  }
  // The validator warns above 500 KB, where agents may truncate the file.
  if (Buffer.byteLength(text, 'utf8') > 500 * 1000) {
    issues.push({
      severity: 'warning',
      message:
        'The file is larger than 500 KB and may exceed AI context limits.',
    });
  }
  const urls = new Set<string>();
  let links = 0;
  let inFence = false;
  let section: { name: string; line: number; items: number } | null = null;
  const names = new Set<string>();
  const closeSection = () => {
    if (section && section.items === 0) {
      issues.push({
        severity: 'warning',
        line: section.line,
        message: `The section '${section.name}' has no links.`,
      });
    }
  };
  lines.forEach((raw, i) => {
    const line = i + 1;
    const t = raw.trim();
    if (/^(```|~~~)/.test(t)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    const at = (severity: FileIssue['severity'], message: string) =>
      issues.push({ severity, message, line, snippet: t });
    if (/^#\s/.test(t) && i !== first) {
      at('error', 'The file must have only one H1 title.');
    } else if (/^##\s/.test(t)) {
      closeSection();
      const name = t.replace(/^##\s+/, '').trim();
      if (names.has(name.toLowerCase())) {
        at('warning', `The section '${name}' is repeated.`);
      }
      names.add(name.toLowerCase());
      section = { name, line, items: 0 };
    } else if (/^#{3,6}\s/.test(t)) {
      at(
        'warning',
        'Only H2 headings delimit sections; deeper headings are not part of the format.',
      );
    } else if (section && /^[-*]\s/.test(t)) {
      const m = LINK_ITEM.exec(t);
      if (!m) {
        at('error', "List items must be links: '- [name](url): description'.");
        return;
      }
      section.items += 1;
      links += 1;
      if (urls.has(m[2])) {
        at('warning', `The URL '${m[2]}' is listed more than once.`);
      }
      urls.add(m[2]);
      if (!isAbsoluteUrl(m[2])) {
        at('error', `The link '${m[2]}' must be an absolute URL.`);
      } else if (m[2].startsWith('http:')) {
        at('warning', `The link '${m[2]}' should use HTTPS.`);
      } else {
        // An absolute link that is not plain HTTP needs no finding.
      }
    } else {
      // Other lines are free text and are not checked here.
    }
  });
  closeSection();
  if (links === 0) {
    issues.push({
      severity: 'warning',
      message: 'The file has no H2 section with a list of links.',
    });
  }
  return issues;
}
