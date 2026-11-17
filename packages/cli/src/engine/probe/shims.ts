/**
 * What a few of webhint's CommonJS packages expect of the module they run in
 * (`@hint/utils-dom` names its debug log after `__filename`), for a runtime that
 * has no such thing. Imported first by the Worker entry, so it runs before any
 * of them.
 */
const filename: unknown = Reflect.get(globalThis, '__filename');
const dirname: unknown = Reflect.get(globalThis, '__dirname');

if (filename === undefined || filename === null) {
  Reflect.set(globalThis, '__filename', '/plumbline/worker.js');
}
if (dirname === undefined || dirname === null) {
  Reflect.set(globalThis, '__dirname', '/plumbline');
}
