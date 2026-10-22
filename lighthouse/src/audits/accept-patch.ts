/**
 * Lighthouse entry point for the `webhint-accept-patch` audit. A one-line wrapper; the
 * check's logic and metadata live in the registry (`../checks/headersx.ts`),
 * reached through `auditById`.
 */
import { auditById } from '../checks/index.js';

export default auditById('accept-patch');
