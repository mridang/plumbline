/**
 * The declarative descriptor every audit in this plugin is generated from.
 *
 * A Lighthouse audit here is nothing but a thin wrapper around one {@link
 * AuditCheck}: the check declares which Lighthouse artifacts it needs, builds
 * the small structural input the reused `src/lib/**` function already takes
 * (through the adapters in `../adapt.ts`), calls that function, and returns its
 * findings. The generic {@link import('../audit-factory.js').makeAudit} factory
 * turns a check into the `Audit` subclass Lighthouse loads, and `result.ts`
 * maps the findings to a score. No per-check scoring or rendering code exists.
 *
 * Titles, descriptions, references and the section (group) a check belongs to
 * are pulled from the compiled webhint hint metadata (see `../meta.ts`) so they
 * are never restated here; a check only restates them when it has no webhint
 * hint to borrow them from.
 */
import type * as LH from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import type { Finding } from '../../../dist/lib/headers/finding.js';
import type { ScoreMode } from '../result.js';

/** One declarative audit: the whole table of these drives the plugin. */
export interface AuditCheck {
  /**
   * Short, unique id. The Lighthouse audit id becomes `webhint-${id}`, and the
   * plugin references the compiled wrapper module `dist/audits/${id}.js`. For a
   * check borrowed from a webhint hint this is the hint's id.
   */
  id: string;
  /**
   * The section this check is grouped under in the report: a category id from
   * `src/core/taxonomy.ts` (the eight CATEGORIES). It decides the Lighthouse
   * group, and is normally taken from the hint metadata, never re-decided.
   */
  section: string;
  /** The Lighthouse artifacts this check reads (its `requiredArtifacts`). */
  requiredArtifacts: readonly string[];
  /** How the findings become a score; see {@link ScoreMode}. */
  scoreMode: ScoreMode;
  /** The audit title (what passes). Usually the webhint hint's name. */
  title: string;
  /** The audit title shown when it fails. Omit for informative checks. */
  failureTitle?: string;
  /** One sentence for the report. Usually the webhint hint's description. */
  description: string;
  /** Where the rule is documented, appended to the description as a link. */
  reference?: string;
  /**
   * Runs the check against the Lighthouse artifacts. Returns the findings (the
   * reused library's shape), or `null` when the data needed was absent from the
   * run, which the factory renders as "not applicable".
   */
  run(
    artifacts: LH.Artifacts,
    context: AuditNS.Context,
  ): Promise<readonly Finding[] | null> | readonly Finding[] | null;
}
