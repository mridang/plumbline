import type { ReportOptions } from 'hint';
import type { CheckResult } from '../../lib/agent/types.js';
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

/** The code snippet options of a check's evidence, if it has any. */
function snippetOptions(
  outcome: CheckResult,
): Pick<ReportOptions, 'codeLanguage' | 'codeSnippet'> | undefined {
  const evidence = outcome.evidence;
  if (!evidence?.snippet) {
    return undefined;
  }
  return {
    codeSnippet: evidence.snippet,
    ...(evidence.language ? { codeLanguage: evidence.language } : {}),
  };
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
          site.report(
            outcome.evidence?.resource ?? site.url.href,
            `${spec.name}: ${outcome.detail}`,
            { severity: Severity.hint, ...snippetOptions(outcome) },
          );
        }
        if (!outcome.passed) {
          site.report(
            outcome.evidence?.resource ?? site.url.href,
            `${spec.name}: ${outcome.detail}`,
            {
              severity: spec.informational ? Severity.hint : Severity.warning,
              ...snippetOptions(outcome),
            },
          );
        }
      });
    },
  });
}
