/**
 * @packageDocumentation
 *
 * What the hints and webhint's DOM expect from Node that a browser lacks,
 * filled in before they load. `Buffer` is read as a global (image sizes, DER,
 * file sniffing); the bundler supplies `node:buffer`, and this puts it where
 * they look. Webhint's DOM resolves links with `require('url').URL`, and the
 * bundler's stand-in for `url` has no `URL`, so it is given the browser's own.
 */

import { Buffer } from 'node:buffer';
import url from 'node:url';

globalThis.Buffer ??= Buffer;
(url as { URL?: typeof URL }).URL ??= URL;
