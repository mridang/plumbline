/**
 * Lighthouse entry point for the `webhint-retry-after` audit. A one-line wrapper; the
 * check's logic and metadata live in the registry (`../checks/headers.ts`),
 * reached through `auditById`.
 */
import { auditById } from '../checks/index.js';

export default auditById('retry-after');
