/**
 * @packageDocumentation
 *
 * The small patterns `plumbline.yaml` uses for environment names: `*` stands
 * for any run of characters (none included) and `?` for exactly one, and the
 * match ignores case. Everything else, including `.` and `[`, is itself. It is
 * a hand-written matcher, not a regular expression, so a pattern from a
 * repository's file can never be slow or invalid.
 */

/** Whether `text` is matched by `pattern` as a whole. */
export function globMatches(pattern: string, text: string): boolean {
  const want = pattern.toLowerCase();
  const have = text.toLowerCase();
  let p = 0;
  let t = 0;
  // Where the last `*` was and how much of the text it has taken so far.
  let star = -1;
  let taken = 0;
  while (t < have.length) {
    if (p < want.length && (want[p] === '?' || want[p] === have[t])) {
      p += 1;
      t += 1;
    } else if (p < want.length && want[p] === '*') {
      star = p;
      taken = t;
      p += 1;
    } else if (star !== -1) {
      p = star + 1;
      taken += 1;
      t = taken;
    } else {
      return false;
    }
  }
  while (p < want.length && want[p] === '*') {
    p += 1;
  }
  return p === want.length;
}

/** Whether `text` is matched by any of `patterns`. */
export function matchesAny(patterns: readonly string[], text: string): boolean {
  return patterns.some((pattern) => globMatches(pattern, text));
}
