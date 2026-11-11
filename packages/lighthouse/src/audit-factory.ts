/**
 * The single generic Lighthouse audit factory. Every audit in this plugin is
 * produced by {@link makeAudit} from one {@link AuditCheck}; there is no
 * hand-written audit logic. The factory sets the static `meta` from the
 * descriptor (id, titles, description, required artifacts, scoring mode), runs
 * the check, and maps its findings to a product via `result.ts`.
 *
 * A Lighthouse *plugin* config is JSON-serialised when it is loaded
 * (`JSON.parse(JSON.stringify(plugin))`), which drops any class reference, so a
 * plugin can only point at audits by module path. Each check therefore has a
 * tiny wrapper module under `audits/` that calls this factory; see
 * `checks/index.ts` (`auditById`).
 */
import { Audit } from 'lighthouse';
import type { Artifacts } from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { notApplicable, productFromFindings } from './result.js';
import type { AuditCheck } from './checks/types.js';

/**
 * Builds the `Audit` subclass Lighthouse loads for a check. The audit id is
 * `webhint-${check.id}` and the required artifacts and scoring mode come
 * straight from the descriptor.
 */
export function makeAudit(check: AuditCheck): typeof Audit {
  // Lighthouse only requires `failureTitle` for a BINARY-displayed audit, but
  // providing it for every graded audit makes the failing row read correctly;
  // informative audits never show a ✔/✖, so they do not need one.
  const meta: AuditNS.Meta = {
    id: `webhint-${check.id}`,
    title: check.title,
    ...(check.failureTitle ? { failureTitle: check.failureTitle } : {}),
    description: check.reference
      ? `${check.description} [Learn more](${check.reference}).`
      : check.description,
    requiredArtifacts:
      check.requiredArtifacts as AuditNS.Meta['requiredArtifacts'],
    scoreDisplayMode: check.scoreMode,
  };

  return class WebhintAudit extends Audit {
    static get meta(): AuditNS.Meta {
      return meta;
    }

    static async audit(
      artifacts: Artifacts,
      context: AuditNS.Context,
    ): Promise<AuditNS.Product> {
      const findings = await check.run(artifacts, context);
      // `null` means the data this check needs was not in the run.
      if (findings === null) {
        return notApplicable();
      }
      return productFromFindings(findings, check.scoreMode);
    }
  };
}
