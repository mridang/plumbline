/**
 * The `agent` check set: the agent-readiness hints a Lighthouse *plugin* can
 * run from the artifacts Lighthouse already gathers. That is exactly one —
 * `agent-link-headers`, which reads the home page's `Link` response header. It
 * reshapes the main document's response into the {@link import('../adapt-agent.js').agentEnv}
 * the reused `src/lib/agent/link-headers.ts` `checkLinkHeaders` takes, and calls
 * that exact function, so a site yields the same finding here as under the hint.
 *
 * NOT implementable as a plugin (left to the webhint hints / a future
 * gatherer): every other check in the agent set needs its own HTTP fetch, DNS
 * query or content-negotiation request, none of which a Lighthouse plugin can
 * make — it only sees the artifacts of the one page load. These stay
 * gatherer-only: agent-robots-txt, agent-sitemap, agent-api-catalog,
 * agent-mcp-server-card, agent-a2a-agent-card, agent-oauth-discovery,
 * agent-oauth-protected-resource, agent-dns-aid, agent-markdown-negotiation,
 * agent-web-bot-auth, agent-content-signals, agent-ai-bot-rules, agent-x402,
 * agent-webmcp, agent-ard, agent-poppy, agent-skills, agent-ucp, agent-acp,
 * agent-auth-md, agent-mpp and agent-score.
 *
 * Scoring mirrors the webhint severity: a missing `Link` header is reported as
 * `warning` (advice), which the plugin fully observes, so the check is graded
 * (`numeric`) — a present agent relation passes, a missing one is advice.
 */
import { finding } from '../../../dist/lib/headers/finding.js';
import { checkLinkHeaders } from '../../../dist/lib/agent/link-headers.js';
import type { HintDefinition } from '../../../dist/core/define-hint.js';
import { agentEnv } from '../adapt-agent.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';

// The compiled webhint hint, imported only for its metadata (name, description,
// reference, section); the check logic is reused through `checkLinkHeaders`.
import agentLinkHeadersHint from '../../../dist/hints/agent/agent-link-headers.js';

/** The artifact set the agent check reads. */
const AGENT_ARTIFACTS = ['DevtoolsLog', 'URL'] as const;

/**
 * Builds a check that borrows its metadata (title, description, reference and
 * the taxonomy section) from a compiled webhint hint. Mirrors the `fromHint`
 * helper in `headers.ts`.
 */
function fromHint(
  definition: HintDefinition,
  config: Pick<AuditCheck, 'scoreMode' | 'run'>,
): AuditCheck {
  const docs = hintDocs(definition);
  return {
    id: definition.id,
    // The agent hints are placed in `llms-ai`; fall back defensively rather
    // than emit an empty group.
    section: docs.section ?? 'llms-ai',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode: config.scoreMode,
    requiredArtifacts: AGENT_ARTIFACTS,
    run: config.run,
  };
}

/** The agent checks, in report order. */
export const agentChecks: readonly AuditCheck[] = [
  // isitagentready.com "Link headers": the home page should send a `Link`
  // header with an agent-useful relation (api-catalog, service-desc, ...). A
  // missing or unhelpful header is reported as advice, matching the hint. The
  // finding message mirrors the webhint report (`${name}: ${detail}`).
  fromHint(agentLinkHeadersHint, {
    scoreMode: 'numeric',
    run: async (artifacts, context) => {
      const env = await agentEnv(artifacts, context);
      if (!env) {
        return null;
      }
      const outcome = await checkLinkHeaders(env);
      if (outcome.passed) {
        // A pass has nothing to report (the check sets no informational note).
        return [];
      }
      const name = hintDocs(agentLinkHeadersHint).name;
      return [finding('warning', `${name}: ${outcome.detail}`)];
    },
  }),
];
