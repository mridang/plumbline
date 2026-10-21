/** The Geolocation API methods that ask the browser for a position. */
const POSITION_METHODS = /\b(?:getCurrentPosition|watchPosition)\b/;

/** The property that exposes the API, as `navigator.geolocation`. */
const GEOLOCATION = /\bgeolocation\b/;

/** Words that stay readable when they are the whole content of a string. */
const KEPT_STRINGS: ReadonlySet<string> = new Set([
  'geolocation',
  'getCurrentPosition',
  'watchPosition',
]);

/**
 * Removes what is not code from a script so that text in comments and
 * strings is not mistaken for a call. Comments are dropped. A string literal
 * becomes `""`, except one that is exactly a name of the API, so that
 * `navigator['geolocation']` and `geo['watchPosition'](cb)` still match.
 * Line breaks inside comments and strings are kept, so a position in the
 * result is on the same line as in the source. Regular expression literals are not recognised, which only matters for one
 * that contains a quote or comment marker.
 */
export function stripCommentsAndStrings(source: string): string {
  let out = '';
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') {
        index++;
      }
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      const comment = source.slice(index, end === -1 ? source.length : end);
      index = end === -1 ? source.length : end + 2;
      out += ' ' + '\n'.repeat((comment.match(/\n/g) ?? []).length);
    } else if (char === '"' || char === "'" || char === '`') {
      let end = index + 1;
      while (end < source.length && source[end] !== char) {
        end += source[end] === '\\' ? 2 : 1;
      }
      const content = source.slice(index + 1, end);
      out += KEPT_STRINGS.has(content)
        ? content
        : '""' + '\n'.repeat((content.match(/\n/g) ?? []).length);
      index = end + 1;
    } else {
      out += char;
      index++;
    }
  }
  return out;
}

/**
 * True when the script asks for the visitor's position. That takes a call to
 * `getCurrentPosition` or `watchPosition` in code that also mentions
 * `geolocation`, which covers `navigator.geolocation.getCurrentPosition(...)`,
 * an alias such as `const geo = navigator.geolocation; geo.watchPosition(...)`
 * and a destructured `const { geolocation } = navigator`. Code that only
 * tests for support (`if (navigator.geolocation)`, `'geolocation' in
 * navigator`) never asks for a position and is not reported, nor is text in
 * comments or strings.
 */
export function usesGeolocation(source: string): boolean {
  const code = stripCommentsAndStrings(source);
  return GEOLOCATION.test(code) && POSITION_METHODS.test(code);
}

/** Where a script asks for the visitor's position. */
export interface GeolocationCall {
  /** Zero-based line of the call. */
  line: number;
  /** Zero-based column of the method name on that line. */
  column: number;
  /** The source line holding the call, trimmed. */
  text: string;
}

/**
 * Finds the first call that asks for the position, or null when the script
 * does not use the API in the way `usesGeolocation` describes.
 */
export function findGeolocationCall(source: string): GeolocationCall | null {
  const code = stripCommentsAndStrings(source);
  if (!GEOLOCATION.test(code)) {
    return null;
  }
  const match = POSITION_METHODS.exec(code);
  if (!match) {
    return null;
  }
  const line = code.slice(0, match.index).split('\n').length - 1;
  const original = source.split('\n')[line] ?? '';
  return {
    line,
    column: Math.max(original.search(POSITION_METHODS), 0),
    text: original.trim(),
  };
}
