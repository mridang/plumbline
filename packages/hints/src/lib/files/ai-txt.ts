import { isAbsoluteUrl, splitLines, type FileIssue } from './issue.js';

export type AiTxtFormat = 'markdown' | 'spawning';

/** Picks the format by looking for front matter or robots style lines. */
export function detectAiTxtFormat(text: string): AiTxtFormat {
  const t = text.replace(/^\uFEFF/, '').trimStart();
  if (
    (t.startsWith('---') || /^#\s/m.test(t)) &&
    !/^user-agent\s*:/im.test(t)
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

/** Validates an aitxt.ing Markdown + YAML front matter file. */
function validateMarkdownAiTxt(text: string): FileIssue[] {
  const issues: FileIssue[] = [];
  const lines = splitLines(text);
  let bodyStart = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (end === -1) {
      issues.push({
        severity: 'error',
        line: 1,
        message: 'The front matter is never closed with ---.',
      });
    } else {
      bodyStart = end + 1;
      const meta: Record<string, string> = {};
      lines.slice(1, end).forEach((l) => {
        const m = l.match(/^([A-Za-z_-]+)\s*:\s*(.*)$/);
        if (m) {
          meta[m[1].toLowerCase()] = m[2].trim().replaceAll(/^["']|["']$/g, '');
        }
      });
      const updated = meta['updated'];
      if (updated === undefined) {
        issues.push({
          severity: 'error',
          line: 1,
          message: "The front matter needs an 'updated' date.",
        });
      } else if (
        !/^\d{4}-\d{2}-\d{2}$/.test(updated) ||
        Number.isNaN(Date.parse(updated))
      ) {
        issues.push({
          severity: 'error',
          line: 1,
          message: `'updated' must be a YYYY-MM-DD date, not '${updated}'.`,
        });
      }
      if (!meta['scope']) {
        issues.push({
          severity: 'error',
          line: 1,
          message: "The front matter needs a 'scope'.",
        });
      }
    }
  } else {
    issues.push({
      severity: 'error',
      line: 1,
      message: "The file needs YAML front matter with 'updated' and 'scope'.",
    });
  }
  const body = lines.slice(bodyStart);
  if (!body.some((l) => /^#\s+\S/.test(l))) {
    issues.push({
      severity: 'error',
      message: 'The file must contain an H1 title.',
    });
  }
  const headings = new Set(
    body
      .filter((l) => /^##\s/.test(l))
      .map((l) =>
        l
          .replace(/^##\s+/, '')
          .trim()
          .toLowerCase(),
      ),
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

/** Validates a Spawning robots-style ai.txt file. */
function validateSpawningAiTxt(text: string): FileIssue[] {
  const issues: FileIssue[] = [];
  let hasAgent = false;
  let hasRule = false;
  splitLines(text).forEach((raw, i) => {
    const line = i + 1;
    const content = raw.replace(/#.*$/, '').trim();
    if (content === '') {
      return;
    }
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
    if (rawKey !== rawKey.trim() || /\s/.test(rawKey)) {
      at('error', `Malformed key '${rawKey}'.`);
    }
    if (key === 'user-agent') {
      hasAgent = true;
    } else if (key === 'sitemap') {
      if (!isAbsoluteUrl(value)) {
        at('error', `The Sitemap '${value}' is not an absolute http(s) URL.`);
      }
    } else {
      if (!hasAgent) {
        at('error', `'${rawKey}' appears before any User-Agent line.`);
      }
      hasRule = true;
      const tokens = value.split(/[\s,]+/).filter(Boolean);
      for (const token of tokens) {
        if (
          !TOKENS.has(token.toLowerCase()) &&
          !/^(\*?\.[\w]+|\/\S*|\*\.\w+)$/.test(token)
        ) {
          at('warning', `Unknown media type token '${token}'.`);
        }
      }
    }
  });
  if (!hasAgent) {
    issues.push({
      severity: 'error',
      message: 'The file has no User-Agent line.',
    });
  } else if (!hasRule) {
    issues.push({
      severity: 'warning',
      message: 'The file has no Allow or Disallow rules.',
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
