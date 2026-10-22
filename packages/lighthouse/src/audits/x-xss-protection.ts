/**
 * Lighthouse entry point for the `webhint-x-xss-protection` audit. A Lighthouse plugin can
 * only reference audits by module path (its config is JSON-serialised, which
 * drops a class reference), so every check in the registry has this one-line
 * wrapper. The check's logic and metadata live in the registry
 * (`../checks/headers.ts`), reached through `auditById`.
 */
import { auditById } from '../checks/index.js';

export default auditById('x-xss-protection');
