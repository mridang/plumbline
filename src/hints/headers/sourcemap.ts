import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { sourcemapFindings } from '../../lib/headers/info-leak.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `SourceMap` (and the legacy `X-SourceMap`) points devtools at a source
 * map that reconstructs the original, unminified source. Shipping it on a
 * production response exposes that source, so the hint reports either header.
 */
export default defineHint({
  id: 'sourcemap',
  name: 'Source map is not exposed in production',
  description:
    'Reports the SourceMap or X-SourceMap header, which exposes source maps to every client.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/SourceMap',
  setup(context) {
    onPage(context, (page) => {
      const sourceMap = headerValue(page.headers, 'sourcemap');
      const xSourceMap = headerValue(page.headers, 'x-sourcemap');
      reportFindings(page, sourcemapFindings(sourceMap, xSourceMap), {
        name: sourceMap !== null ? 'SourceMap' : 'X-SourceMap',
        value: sourceMap ?? xSourceMap,
      });
    });
  },
});
