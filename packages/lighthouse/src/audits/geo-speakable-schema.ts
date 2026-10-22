/**
 * Lighthouse entry point for the `webhint-geo-speakable-schema` audit.
 * A Lighthouse plugin can only reference audits by module path, so every check
 * has this one-line wrapper; its logic lives in `../checks/geo.ts`.
 */
import { auditById } from '../checks/index.js';

export default auditById('geo-speakable-schema');
