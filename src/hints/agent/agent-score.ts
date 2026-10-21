import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { computeScore } from '../../lib/agent/score.js';
import { allResults } from './scan.js';

/**
 * The overall agent readiness score, in the structure of
 * isitagentready.com: a 0-100 score, a level name and per-category scores
 * with passed/total counts. Weights and level thresholds are provisional;
 * see `src/lib/agent/score.ts`. Always reported as information.
 */
export default defineHint({
  id: 'agent-score',
  name: 'Agent readiness score',
  description: 'Reports the overall agent readiness score and level.',
  category: Category.other,
  groups: ['agent-ready', 'agent'],
  reference: 'https://isitagentready.com',
  setup(context) {
    onSite(context, async (site) => {
      const { results, commerceDetected } = await allResults(context, site);
      const { score, level, categories } = computeScore(
        results,
        commerceDetected,
      );
      const parts = categories.map((c) =>
        c.counted
          ? `${c.label} ${c.score} (${c.passed}/${c.total})`
          : `${c.label} not checked`,
      );
      site.report(
        site.url.href,
        `Agent readiness score ${score}/100, level ${level.level} "${level.name}". ${parts.join('; ')}.`,
        { severity: Severity.hint },
      );
    });
  },
});
