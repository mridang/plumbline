import { Severity } from '@hint/utils-types';
import {
  Category,
  defineHint,
  type HintDefinition,
} from '../../core/define-hint.js';
import type { Group } from '../../core/groups.js';
import { onSite } from '../../core/page.js';
import { resultFor } from './scan.js';

export interface AgentHintSpec {
  /** Check id and hint id, for example `agent-robots-txt`. */
  id: string;
  name: string;
  description: string;
  reference: string;
  /** Topic groups added to `agent-ready` and `agent`. */
  extraGroups?: readonly Group[];
  /** Informational hints report with `Severity.hint`. */
  informational?: boolean;
  category?: Category;
}

/**
 * Builds the hint for one isitagentready.com check: it runs the check from
 * `src/lib/agent` once the scan is done and reports its detail when the
 * check fails.
 */
export function agentHint(spec: AgentHintSpec): HintDefinition {
  return defineHint({
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: spec.category ?? Category.development,
    groups: ['agent-ready', 'agent', ...(spec.extraGroups ?? [])],
    reference: spec.reference,
    setup(context) {
      onSite(context, async (site) => {
        const outcome = await resultFor(context, site, spec.id);
        if (outcome.passed && outcome.note) {
          // A pass that still has an informational conclusion to show.
          site.report(site.url.href, `${spec.name}: ${outcome.detail}`, {
            severity: Severity.hint,
          });
        }
        if (!outcome.passed) {
          site.report(site.url.href, `${spec.name}: ${outcome.detail}`, {
            severity: spec.informational ? Severity.hint : Severity.warning,
          });
        }
      });
    },
  });
}
