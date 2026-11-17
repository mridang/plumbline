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
  // eslint-disable-next-line functional/no-let -- the matcher walks pattern and text with two moving positions, as a loop that cannot overflow the stack
  let p = 0;
  // eslint-disable-next-line functional/no-let -- position in the text
  let t = 0;
  // Where the last `*` was and how much of the text it has taken so far.
  // eslint-disable-next-line functional/no-let -- position of the last `*` in the pattern
  let star = -1;
  // eslint-disable-next-line functional/no-let -- how much of the text the last `*` has taken
  let taken = 0;
  // eslint-disable-next-line functional/no-loop-statements -- an iterative matcher: recursion could overflow the stack on a long name, and a pattern from a repository's file must never fail
  while (t < have.length) {
    if (
      p < want.length &&
      (want.codePointAt(p) === 63 || want[p] === have[t])
    ) {
      p += 1;
      t += 1;
    } else if (p < want.length && want.codePointAt(p) === 42) {
      star = p;
      taken = t;
      p += 1;
    } else if (star === -1) {
      return false;
    } else {
      p = star + 1;
      taken += 1;
      t = taken;
    }
  }
  // eslint-disable-next-line functional/no-loop-statements -- skips the trailing `*` of the pattern
  while (p < want.length && want.codePointAt(p) === 42) {
    p += 1;
  }
  return p === want.length;
}

/** Whether `text` is matched by any of `patterns`. */
export function matchesAny(patterns: readonly string[], text: string): boolean {
  return patterns.some((pattern) => globMatches(pattern, text));
}
