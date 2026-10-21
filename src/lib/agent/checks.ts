import { checkApiCatalog } from './api-catalog.js';
import { checkArd } from './ard.js';
import { checkWebBotAuth } from './bot-auth.js';
import { checkA2aAgentCard, checkMcpServerCard, checkSkills } from './cards.js';
import { checkAcp, checkMpp, checkUcp, checkX402 } from './commerce.js';
import { checkDnsAid } from './dns-aid.js';
import { checkLinkHeaders } from './link-headers.js';
import { checkMarkdownNegotiation } from './markdown.js';
import {
  checkAuthMd,
  checkOauthDiscovery,
  checkOauthProtectedResource,
} from './oauth.js';
import { checkPoppy } from './poppy.js';
import {
  checkAiBotRules,
  checkContentSignals,
  checkRobotsTxt,
  checkSitemap,
} from './robots.js';
import type { AgentCategory, AgentEnv, CheckResult } from './types.js';
import { checkWebMcp } from './webmcp.js';

/** A check and how it takes part in the score. */
export interface CheckDefinition {
  /** The hint id, for example `agent-robots-txt`. */
  id: string;
  category: AgentCategory;
  /**
   * False for checks reported but not counted: isitagentready.com counts
   * 4/1/2/8 checks in the first four categories, so the newest protocols
   * (Web Bot Auth, ARD, Poppy) are reported without affecting the score.
   */
  scored: boolean;
  run(env: AgentEnv): Promise<CheckResult>;
}

/** Every check, in report order. */
export const CHECKS: readonly CheckDefinition[] = [
  {
    id: 'agent-robots-txt',
    category: 'discoverability',
    scored: true,
    run: checkRobotsTxt,
  },
  {
    id: 'agent-sitemap',
    category: 'discoverability',
    scored: true,
    run: checkSitemap,
  },
  {
    id: 'agent-link-headers',
    category: 'discoverability',
    scored: true,
    run: checkLinkHeaders,
  },
  {
    id: 'agent-dns-aid',
    category: 'discoverability',
    scored: true,
    run: checkDnsAid,
  },
  {
    id: 'agent-markdown-negotiation',
    category: 'content',
    scored: true,
    run: checkMarkdownNegotiation,
  },
  {
    id: 'agent-ai-bot-rules',
    category: 'bot-access',
    scored: true,
    run: checkAiBotRules,
  },
  {
    id: 'agent-content-signals',
    category: 'bot-access',
    scored: true,
    run: checkContentSignals,
  },
  {
    id: 'agent-web-bot-auth',
    category: 'bot-access',
    scored: false,
    run: checkWebBotAuth,
  },
  {
    id: 'agent-oauth-discovery',
    category: 'discovery',
    scored: true,
    run: checkOauthDiscovery,
  },
  {
    id: 'agent-oauth-protected-resource',
    category: 'discovery',
    scored: true,
    run: checkOauthProtectedResource,
  },
  {
    id: 'agent-api-catalog',
    category: 'discovery',
    scored: true,
    run: checkApiCatalog,
  },
  {
    id: 'agent-auth-md',
    category: 'discovery',
    scored: true,
    run: checkAuthMd,
  },
  {
    id: 'agent-mcp-server-card',
    category: 'discovery',
    scored: true,
    run: checkMcpServerCard,
  },
  {
    id: 'agent-a2a-agent-card',
    category: 'discovery',
    scored: true,
    run: checkA2aAgentCard,
  },
  { id: 'agent-skills', category: 'discovery', scored: true, run: checkSkills },
  { id: 'agent-webmcp', category: 'discovery', scored: true, run: checkWebMcp },
  { id: 'agent-ard', category: 'discovery', scored: false, run: checkArd },
  { id: 'agent-poppy', category: 'discovery', scored: false, run: checkPoppy },
  { id: 'agent-x402', category: 'commerce', scored: true, run: checkX402 },
  { id: 'agent-mpp', category: 'commerce', scored: true, run: checkMpp },
  { id: 'agent-ucp', category: 'commerce', scored: true, run: checkUcp },
  { id: 'agent-acp', category: 'commerce', scored: true, run: checkAcp },
];

/** Looks a check up by id; throws for an unknown id (a programming error). */
export function checkById(id: string): CheckDefinition {
  const found = CHECKS.find((check) => check.id === id);
  if (!found) {
    throw new Error(`Unknown agent check: ${id}`);
  }
  return found;
}

/**
 * Runs one check. A check that throws is a failed check, never a crashed
 * scan.
 */
export async function runCheck(
  check: CheckDefinition,
  env: AgentEnv,
): Promise<CheckResult> {
  try {
    return await check.run(env);
  } catch (error) {
    return {
      id: check.id,
      category: check.category,
      passed: false,
      detail: `The check failed to run: ${(error as Error).message}`,
    };
  }
}
