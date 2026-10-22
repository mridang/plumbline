/**
 * Lighthouse entry point for the `webhint-twitter-image-missing` audit. A Lighthouse plugin can
 * only reference audits by module path, so every check has this one-line
 * wrapper; the logic and metadata live in the registry
 * (`../checks/opengraph.ts`), reached through `auditById`.
 */
import { auditById } from '../checks/index.js';

export default auditById('twitter-image-missing');
