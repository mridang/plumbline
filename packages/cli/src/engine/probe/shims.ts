/**
 * What a few of webhint's CommonJS packages expect of the module they run in
 * (`@hint/utils-dom` names its debug log after `__filename`), for a runtime that
 * has no such thing. Imported first by the Worker entry, so it runs before any
 * of them.
 */
const scope = globalThis as unknown as Record<string, unknown>;

// eslint-disable-next-line functional/immutable-data -- the shim has to define a global the CommonJS packages read
scope.__filename ??= '/plumbline/worker.js';
// eslint-disable-next-line functional/immutable-data -- the shim has to define a global the CommonJS packages read
scope.__dirname ??= '/plumbline';
