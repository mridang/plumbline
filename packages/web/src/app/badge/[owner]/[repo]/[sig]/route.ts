/**
 * A repository's badge, to paste into its README.
 *
 *   GET /badge/{owner}/{repo}/{signature}.svg → 200 image/svg+xml
 *
 * Shows one score for how the repository's sites stand. The signature is the
 * one the app handed out for that repository (see `domain/badge/sign.ts`); any
 * other address answers 404, so a private repository's standing cannot be read
 * by guessing its name. The image is cached for five minutes by the browser
 * and GitHub's image proxy.
 */

import { badgeSvg } from '@/domain/badge/svg';
import { colourOf, repoScore } from '@/domain/badge/score';
import { verifyRepo } from '@/domain/badge/sign';
import { getDatabase } from '@/domain/db/client';
import { sitesOfRepo } from '@/domain/db/badge';
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
export async function GET(_request: Request, { params }: Context) {
  const { owner, repo, sig } = await params;
  const repository = `${decodeURIComponent(owner)}/${decodeURIComponent(repo)}`;
  const signature = sig.replace(/\.svg$/, '');
  if (!(await verifyRepo(getEnv().SESSION_SECRET, repository, signature))) {
    return new Response('Not found', { status: 404 });
  }
  const score = repoScore(await sitesOfRepo(getDatabase(), repository));
  return new Response(
    badgeSvg(
      'plumbline',
      score === null ? 'not checked' : `${score}%`,
      colourOf(score),
    ),
    {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    },
  );
}
