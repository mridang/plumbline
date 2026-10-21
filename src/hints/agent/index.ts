import type { HintDefinition } from '../../core/define-hint.js';
import agentA2aAgentCard from './agent-a2a-agent-card.js';
import agentAcp from './agent-acp.js';
import agentAiBotRules from './agent-ai-bot-rules.js';
import agentApiCatalog from './agent-api-catalog.js';
import agentArd from './agent-ard.js';
import agentAuthMd from './agent-auth-md.js';
import agentContentSignals from './agent-content-signals.js';
import agentDnsAid from './agent-dns-aid.js';
import agentLinkHeaders from './agent-link-headers.js';
import agentMarkdownNegotiation from './agent-markdown-negotiation.js';
import agentMcpServerCard from './agent-mcp-server-card.js';
import agentMpp from './agent-mpp.js';
import agentOauthDiscovery from './agent-oauth-discovery.js';
import agentOauthProtectedResource from './agent-oauth-protected-resource.js';
import agentPoppy from './agent-poppy.js';
import agentRobotsTxt from './agent-robots-txt.js';
import agentScore from './agent-score.js';
import agentSitemap from './agent-sitemap.js';
import agentSkills from './agent-skills.js';
import agentUcp from './agent-ucp.js';
import agentWebBotAuth from './agent-web-bot-auth.js';
import agentWebmcp from './agent-webmcp.js';
import agentX402 from './agent-x402.js';

/** Hints of the `agent` set. */
export const agentHints: readonly HintDefinition[] = [
  agentRobotsTxt,
  agentSitemap,
  agentLinkHeaders,
  agentDnsAid,
  agentMarkdownNegotiation,
  agentAiBotRules,
  agentContentSignals,
  agentWebBotAuth,
  agentOauthDiscovery,
  agentOauthProtectedResource,
  agentApiCatalog,
  agentAuthMd,
  agentMcpServerCard,
  agentA2aAgentCard,
  agentSkills,
  agentWebmcp,
  agentArd,
  agentPoppy,
  agentX402,
  agentMpp,
  agentUcp,
  agentAcp,
  agentScore,
];
