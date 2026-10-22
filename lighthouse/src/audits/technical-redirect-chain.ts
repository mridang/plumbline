/**
 * Lighthouse entry point for the `webhint-technical-redirect-chain` audit.
 * A Lighthouse plugin can only reference audits by module path, so every check
 * has this one-line wrapper; its logic lives in `../checks/technical.ts`.
 */
import { auditById } from '../checks/index.js';

export default auditById('technical-redirect-chain');
