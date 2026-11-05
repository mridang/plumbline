/**
 * Hide a repository from the signed-in person's dashboard.
 *
 *   PUT    /api/users/self/repositories/hidden/:owner/:repo → 204
 *   DELETE /api/users/self/repositories/hidden/:owner/:repo → 204
 *
 * The behaviour lives in the `hiddenRepository` controller; this file only
 * mounts it.
 */

import { hiddenRepository } from '@/domain/api/hidden';

export const dynamic = 'force-dynamic';

export const { PUT, DELETE } = hiddenRepository.handlers();
