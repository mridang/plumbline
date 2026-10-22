import { Severity } from '@hint/utils-types';
import type { FindingSeverity } from '../../lib/headers/finding.js';

/**
 * Maps a library {@link FindingSeverity} onto webhint's {@link Severity} enum.
 * The single-source SEO rules in `src/lib/seo/checks.ts` return findings with a
 * plain string severity (so they carry no webhint types); each hint turns that
 * back into the enum webhint's `report` expects.
 */
export function toSeverity(severity: FindingSeverity): Severity {
  switch (severity) {
    case 'error':
      return Severity.error;
    case 'warning':
      return Severity.warning;
    case 'hint':
      return Severity.hint;
  }
}
