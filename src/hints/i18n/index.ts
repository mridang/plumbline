import type { HintDefinition } from '../../core/define-hint.js';
import hreflangReturn from './hreflang-return.js';
import hreflangXDefault from './hreflang-x-default.js';
import hreflangValidCodes from './hreflang-valid-codes.js';
import hreflangSelf from './hreflang-self.js';
import hreflangDuplicate from './hreflang-duplicate.js';
import alternateMedia from './alternate-media.js';
import paginationRel from './pagination-rel.js';

/** Hints of the `i18n` set: hreflang, alternates and pagination link relations. */
export const i18nHints: readonly HintDefinition[] = [
  hreflangReturn,
  hreflangXDefault,
  hreflangValidCodes,
  hreflangSelf,
  hreflangDuplicate,
  alternateMedia,
  paginationRel,
];
