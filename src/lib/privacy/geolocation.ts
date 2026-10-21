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
 * Regular expression literals are not recognised, which only matters for one
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
      index = end === -1 ? source.length : end + 2;
      out += ' ';
    } else if (char === '"' || char === "'" || char === '`') {
      let end = index + 1;
      while (end < source.length && source[end] !== char) {
        end += source[end] === '\\' ? 2 : 1;
      }
      const content = source.slice(index + 1, end);
      out += KEPT_STRINGS.has(content) ? content : '""';
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
