/**
 * Lighthouse entry point for the `webhint-tabnabbing` audit. A Lighthouse plugin can
 * only reference audits by module path, so every check has this one-line
 * wrapper; the check's logic and metadata live in the registry
 * (`../checks/secplus.ts`), reached through `auditById`.
 */
import { auditById } from '../checks/index.js';

export default auditById('tabnabbing');
