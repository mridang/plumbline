import type { HintDefinition } from '../../core/define-hint.js';
import xDnsPrefetchControl from './x-dns-prefetch-control.js';

/** Security header checks from Observatory, OWASP and Webbkoll. */
export const headersHints: readonly HintDefinition[] = [xDnsPrefetchControl];
