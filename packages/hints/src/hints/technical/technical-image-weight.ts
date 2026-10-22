import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  formatKb,
  imageUrls,
  mapWithConcurrency,
} from '../../lib/technical/read.js';
import { imageWeightFinding } from '../../lib/technical/checks.js';

/**
 * Measures each distinct <img> through its Content-Length (falling back to the body size), five at a time. Over 200 KB is a warning, over 500 KB an error. Source: LLMScout "image-weight".
 */
export default defineHint({
  id: 'technical-image-weight',
  name: 'Images are light',
  description:
    'Warns when an image is over 200 KB and errors when it is over 500 KB.',
  category: Category.development,
  groups: ['llmscout', 'seo'],
  reference: 'https://github.com/RudrenduPaul/LLMScout',
  setup(context) {
    onPage(context, async (page) => {
      const urls = imageUrls(page.document, page.url);
      const sizes = await mapWithConcurrency(urls, 5, async (url) => {
        try {
          const data = await context.fetchContent(url);
          if (data.response.statusCode >= 400) {
            return null;
          }
          const length = Number(data.response.headers['content-length']);
          return Number.isFinite(length) && length > 0
            ? length
            : data.response.body.rawContent.length;
        } catch {
          // An unreachable image cannot be measured and is not reported.
          return null;
        }
      });
      urls.forEach((url, i) => {
        const bytes = sizes[i];
        // An unreachable image (null size) cannot be measured and is skipped;
        // the shared check turns a measured size into its finding, or null when
        // the image is light enough to pass.
        const found = bytes === null ? null : imageWeightFinding(url, bytes);
        if (found !== null && bytes !== null) {
          context.report(url, found.message, {
            severity:
              found.severity === 'error' ? Severity.error : Severity.warning,
            codeSnippet: `${formatKb(bytes)} (${bytes} bytes)`,
          });
        }
      });
    });
  },
});
