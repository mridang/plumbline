/**
 * `@mridang/plumbline-docker` runs the `plumbline` checks against a
 * URL and returns the findings as JSON. It is shipped only as a Docker image
 * (an HTTP server), and is not published to npm. The scan and report logic
 * lives in the published CLI package, `@mridang/plumbline`, which this server
 * shares with `plumbline scan`; only the HTTP layer is here.
 */
export { createScanServer, start } from './server.js';
export type { RunFn, ScanFn, ServerOptions } from './server.js';
