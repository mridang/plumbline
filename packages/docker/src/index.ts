/**
 * `@mridang/webhint-docker-extra` runs the `webhint-hints` checks against a
 * URL and returns the findings as JSON. It is shipped only as a Docker image
 * (an HTTP server), and is not published to npm; these exports exist so the
 * scan and report logic can be unit tested and reused programmatically.
 */
export { scan, hintCatalogue, allHintIds, hintConfig } from './scan.js';
export type { ScanOptions, ScanResult, HintMeta } from './scan.js';
export { buildReport, saveReport } from './report.js';
export type { Report, Finding, Summary, SavedReport } from './report.js';
export { createScanServer, start } from './server.js';
