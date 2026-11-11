/**
 * Read the signed-in person's GitHub installations again.
 *
 *   POST /api/github/syncs → 200 {repositories, deployed, domains_added}.
 *
 * The behaviour lives in the `githubSyncs` controller; this file only mounts it.
 */

import { githubSyncs } from '@/domain/api/github';

export const dynamic = 'force-dynamic';

export const { POST } = githubSyncs.handlers();
