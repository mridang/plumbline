/**
 * Lighthouse entry point for the `webhint-attribution-reporting` audit. A one-line wrapper; the
 * check's logic and metadata live in the registry (`../checks/headersx.ts`),
 * reached through `auditById`.
 */
import { auditById } from '../checks/index.js';

export default auditById('attribution-reporting');
