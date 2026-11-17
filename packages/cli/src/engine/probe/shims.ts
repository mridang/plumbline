/**
 * What a few of webhint's CommonJS packages expect of the module they run in
 * (`@hint/utils-dom` names its debug log after `__filename`), for a runtime that
 * has no such thing. Imported first by the Worker entry, so it runs before any
 * of them.
 */
if (!('__filename' in globalThis)) {
  Reflect.set(globalThis, '__filename', '/plumbline/worker.js');
}
if (!('__dirname' in globalThis)) {
  Reflect.set(globalThis, '__dirname', '/plumbline');
}
