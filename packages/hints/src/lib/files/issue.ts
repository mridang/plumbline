/** Matches a trailing colon. */
const TRAILING_COLON = /:$/u;

/** Matches any line break sequence. */
const LINE_BREAK = /\r\n|\r|\n/u;

/** Matches a leading byte order mark. */
const LEADING_BOM = /^\uFEFF/u;
/** One finding produced by a file validator. */
export interface FileIssue {
  /** `error` is a violated rule, `warning` is advice, `hint` is information. */
  severity: 'error' | 'warning' | 'hint';
  message: string;
  /** 1-based line number the finding refers to, when it has one. */
  line?: number;
  /** The offending line, for use as a code snippet. */
  snippet?: string;
}

/** Splits text into lines, accepting LF, CRLF and CR, and drops a BOM. */
export function splitLines(text: string): string[] {
  return text.replace(LEADING_BOM, '').split(LINE_BREAK);
}

/** True when `value` is an absolute URL using one of the given schemes. */
export function isAbsoluteUrl(
  value: string,
  schemes: readonly string[] = ['http', 'https'],
): boolean {
  try {
    const url = new URL(value);
    return schemes.includes(url.protocol.replace(TRAILING_COLON, ''));
  } catch {
    return false;
  }
}
