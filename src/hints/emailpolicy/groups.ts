import type { Group } from '../../core/groups.js';

/**
 * The groups every hint in this set belongs to. The source group `ietf` (new
 * to the package when this set landed) marks that these checks come from IETF
 * RFCs rather than one of the scanner-derived sources; `email` and `dns` are
 * the topics they touch. Keeping the list here lets every hint share one
 * declaration instead of repeating it.
 */
export const EMAILPOLICY_GROUPS: readonly Group[] = ['ietf', 'email', 'dns'];
