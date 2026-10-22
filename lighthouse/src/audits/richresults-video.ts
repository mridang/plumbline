/**
 * Lighthouse entry point for the `webhint-richresults-video` audit.
 * A Lighthouse plugin can only reference audits by module path, so every check
 * has this one-line wrapper; its logic lives in `../checks/richresults.ts`.
 */
import { auditById } from '../checks/index.js';

export default auditById('richresults-video');
