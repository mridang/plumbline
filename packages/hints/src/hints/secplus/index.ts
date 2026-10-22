import type { HintDefinition } from '../../core/define-hint.js';
import tabnabbing from './tabnabbing.js';
import cspStrength from './csp-strength.js';
import cookiePrefixes from './cookie-prefixes.js';
import httpMethods from './http-methods.js';
import formActionSecure from './form-action-secure.js';

/**
 * Hints of the `secplus` set: security checks beyond the single-header ones —
 * reverse tabnabbing, CSP depth, cookie-prefix correctness, HTTP methods and
 * insecure form actions. The lead wires this array into `src/hints/index.ts`.
 */
export const secplusHints: readonly HintDefinition[] = [
  tabnabbing,
  cspStrength,
  cookiePrefixes,
  httpMethods,
  formActionSecure,
];
