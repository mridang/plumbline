/**
 * A repository's badge, to paste into its README.
 *
 *   GET /badge/{owner}/{repo}/{signature}.svg → 200 image/svg+xml
 *
 * Shows one score for how the repository's sites stand. The signature is the
 * one the app handed out for that repository (see `domain/badge/sign.ts`); any
 * other address answers 404, so a private repository's standing cannot be read
 * by guessing its name. The image is never kept by age: it is checked with the
 * server each time and answers 304 when the score has not changed.
 */

import { badgeSvg } from '@/domain/badge/svg';
import { colourOf, repoScore } from '@/domain/badge/score';
import { verifyRepo } from '@/domain/badge/sign';
import { getDatabase } from '@/domain/db/client';
import { sitesOfRepo } from '@/domain/db/badge';
import { entityTag } from '@/lib/core/api';
import { getEnv } from '@/lib/core/runtime';

export const dynamic = 'force-dynamic';

/** The dynamic segments of the badge address. */
interface Context {
  readonly params: Promise<{
    readonly owner: string;
    readonly repo: string;
    readonly sig: string;
  }>;
}

/** The badge image. */
export async function GET(request: Request, { params }: Context) {
  const { owner, repo, sig } = await params;
  const repository = `${decodeURIComponent(owner)}/${decodeURIComponent(repo)}`;
  const signature = sig.replace(/\.svg$/, '');
  if (!(await verifyRepo(getEnv().SESSION_SECRET, repository, signature))) {
    return new Response('Not found', { status: 404 });
  }
  const score = repoScore(await sitesOfRepo(getDatabase(), repository));
  const image = badgeSvg(
    'plumbline',
    score === null ? 'not checked' : `${score}%`,
    colourOf(score),
  );
  // Nothing is kept by age: the image is checked with the server every time
  // (`no-cache`), and costs a 304 when the score has not changed.
  const tag = await entityTag(image);
  const headers = {
    'Cache-Control': 'no-cache',
    ETag: tag,
  };
  if (request.headers.get('if-none-match') === tag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(image, {
    headers: { ...headers, 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
}
