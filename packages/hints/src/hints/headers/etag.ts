import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { etagFindings } from '../../lib/headers/caching.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `ETag` is an opaque validator for conditional requests. Any value is
 * accepted, but a value that looks like Apache's `inode-size-mtime` triple is
 * reported, because it discloses server internals and differs across
 * load-balanced nodes.
 */
export default defineHint({
  id: 'etag',
  name: 'ETag does not leak server internals',
  description:
    'Reports an ETag that looks like a filesystem inode and so leaks server internals.',
  category: Category.performance,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'etag');
      reportFindings(page, etagFindings(value), { name: 'ETag', value });
    });
  },
});
