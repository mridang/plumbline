/**
 * @packageDocumentation
 *
 * The server's clock, for a page that draws times as words ("2 hours ago").
 * The page reads it once and hands it down, so the browser draws the same
 * words the server did; reading the clock in the middle of a component would
 * give each side its own time.
 */

/** The time now, in milliseconds since 1970. */
export function serverNow(): number {
  return Date.now();
}
