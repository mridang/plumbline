/**
 * What a few of webhint's CommonJS packages expect of the module they run in
 * (`@hint/utils-dom` names its debug log after `__filename`), for a runtime that
 * has no such thing. Imported first by the Worker entry, so it runs before any
 * of them.
 */
const scope = globalThis as unknown as Record<string, unknown>;

scope['__filename'] ??= '/plumbline/worker.js';
scope['__dirname'] ??= '/plumbline';
