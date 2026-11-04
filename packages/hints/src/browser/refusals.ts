/**
 * @packageDocumentation
 *
 * What the browser stand-ins refused. A browser cannot open raw TCP or TLS
 * connections, start a program or read files, so the stand-ins in this folder
 * (swapped in for Node's modules by the `browser` field of `package.json`)
 * throw instead. Many hints catch connection errors and report them as the
 * site's fault ("no HTTPS", "mail server unreachable"), which would be wrong
 * here; so each refusal is also noted, and whoever runs the hints in a browser
 * reads the note after each hint and shows that hint as not run.
 *
 * The note is one set for the whole module, so it is only accurate when one
 * hint runs at a time in this JavaScript realm (one per Web Worker, say).
 */

/** What a hint asked for that a browser cannot give. */
export type Refusal = 'socket' | 'process' | 'file' | 'crypto';

/** Thrown in place of the connection, process or file a hint asked for. */
export class BrowserRefusalError extends Error {
  public readonly refusal: Refusal;

  public constructor(refusal: Refusal, what: string) {
    super(`A browser cannot ${what}.`);
    this.name = 'BrowserRefusalError';
    this.refusal = refusal;
  }
}

const noted = new Set<Refusal>();

/** Note the refusal and throw it. */
export function refuse(refusal: Refusal, what: string): never {
  noted.add(refusal);
  throw new BrowserRefusalError(refusal, what);
}

/** What was refused since the last call, and start a fresh note. */
export function takeRefusals(): ReadonlySet<Refusal> {
  const taken = new Set(noted);
  noted.clear();
  return taken;
}
