/**
 * The signed-in person's connected GitHub account.
 *
 *   DELETE /api/users/self/github → 204 (404 when none is connected).
 *
 * The behaviour lives in the `githubLink` controller; this file only mounts it.
 */

import { githubLink } from '@/domain/api/github';

export const dynamic = 'force-dynamic';

export const { DELETE } = githubLink.handlers();
