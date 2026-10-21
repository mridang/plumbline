import type { HintDefinition } from '../../core/define-hint.js';
import aiTxt from './ai-txt.js';
import llmsFullTxt from './llms-full-txt.js';
import llmsTxt from './llms-txt.js';
import robotsTxt from './robots-txt.js';
import securityTxt from './security-txt.js';

/** Hints of the `files` set. */
export const filesHints: readonly HintDefinition[] = [
  robotsTxt,
  securityTxt,
  llmsTxt,
  llmsFullTxt,
  aiTxt,
];
