/**
 * Turn the checks of a repository off or on.
 *
 *   PUT    /api/users/self/repositories/disabled/:owner/:repo → 204
 *   DELETE /api/users/self/repositories/disabled/:owner/:repo → 204
 *
 * The behaviour lives in the `disabledRepository` controller; this file only
 * mounts it.
 */

import { disabledRepository } from '@/domain/api/disabled';

export const dynamic = 'force-dynamic';

export const { PUT, DELETE } = disabledRepository.handlers();
