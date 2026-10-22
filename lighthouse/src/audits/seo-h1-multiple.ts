/**
 * Lighthouse entry point for the `webhint-seo-h1-multiple` audit. A Lighthouse plugin can
 * only reference audits by module path (its config is JSON-serialised, which
 * drops a class reference), so every check in the registry has this one-line
 * wrapper. The check's logic and metadata live in the registry
 * (`../checks/seo.ts`), reached through `auditById`.
 */
import { auditById } from '../checks/index.js';

export default auditById('seo-h1-multiple');
