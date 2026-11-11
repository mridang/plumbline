import type { AgentEnv, CheckResult, Evidence, Probe } from './types.js';
import {
  evidenceFor,
  isHtml,
  isOk,
  missingReason,
  result,
  urlOf,
} from './util.js';

/** The directives of a robots.txt file that the agent checks care about. */
export interface Robots {
  /** Every `User-agent` value, in order. */
  userAgents: string[];
  /** Every `Sitemap` value. */
  sitemaps: string[];
  /** Every `Content-Signal` value. */
  contentSignals: string[];
  /** Every `Agentmap` value (Agentic Resource Discovery). */
  agentmaps: string[];
}

/** Parses the directives we need; unknown lines and comments are ignored. */
export function parseRobots(body: string): Robots {
  const robots: Robots = {
    userAgents: [],
    sitemaps: [],
    contentSignals: [],
    agentmaps: [],
  };
  for (const raw of body.split(/\r?\n/)) {
    // Comments start at `#` and run to the end of the line.
    const line = raw.replace(/#.*$/, '').trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    const value = match[2].trim();
    switch (match[1].toLowerCase()) {
      case 'user-agent': {
        if (value) robots.userAgents.push(value);
        break;
      }
      case 'sitemap': {
        if (value) robots.sitemaps.push(value);
        break;
      }
      case 'content-signal': {
        if (value) robots.contentSignals.push(value);
        break;
      }
      case 'agentmap': {
        if (value) robots.agentmaps.push(value);
        break;
      }
      default: {
        break;
      }
    }
  }
  return robots;
}

/** A minimal robots.txt to publish. */
function robotsExample(env: AgentEnv, signal = false): string {
  return [
    'User-agent: *',
    ...(signal ? ['Content-Signal: ai-train=no, search=yes, ai-input=no'] : []),
    'Allow: /',
    '',
    `Sitemap: ${env.origin}/sitemap.xml`,
  ].join('\n');
}

/** Evidence for a robots.txt that is missing or lacks something. */
function robotsEvidence(
  env: AgentEnv,
  probe: Probe | null,
  signal = false,
): Evidence {
  return evidenceFor(env, '/robots.txt', probe, robotsExample(env, signal));
}

/** Fetches and parses /robots.txt; undefined when it is missing. */
export async function loadRobots(env: AgentEnv): Promise<Robots | undefined> {
  const probe = await env.probe('/robots.txt');
  // An HTML answer is a soft 404, not a robots.txt.
  return isOk(probe) && !isHtml(probe) ? parseRobots(probe.body) : undefined;
}

/**
 * Robots.txt: `GET /robots.txt` answers 200 as `text/plain` and holds at
 * least one valid `User-agent` directive (RFC 9309).
 */
export async function checkRobotsTxt(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-robots-txt';
  const probe = await env.probe('/robots.txt');
  if (!isOk(probe)) {
    return result(
      id,
      'discoverability',
      false,
      `${missingReason('/robots.txt', probe)}.`,
      robotsEvidence(env, probe),
    );
  }
  if (!/^text\/plain/i.test(probe.contentType)) {
    return result(
      id,
      'discoverability',
      false,
      `/robots.txt is served as '${probe.contentType || 'no content type'}', not text/plain.`,
      evidenceFor(
        env,
        '/robots.txt',
        probe,
        `Content-Type: ${probe.contentType || 'text/plain; charset=utf-8'}`,
        'http',
      ),
    );
  }
  const robots = parseRobots(probe.body);
  if (robots.userAgents.length === 0) {
    return result(
      id,
      'discoverability',
      false,
      '/robots.txt has no User-agent directive.',
      robotsEvidence(env, probe),
    );
  }
  return result(
    id,
    'discoverability',
    true,
    `/robots.txt defines ${robots.userAgents.length} User-agent directive(s).`,
  );
}

/** A sitemap is valid when it is an XML `urlset` or `sitemapindex`. */
export function isSitemap(probe: Probe | null): boolean {
  return (
    isOk(probe) &&
    /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<(\w+:)?(urlset|sitemapindex)[\s>]/.test(
      probe.body,
    )
  );
}

/**
 * Sitemap: each `Sitemap:` URL in robots.txt (or `/sitemap.xml` when there
 * is none) answers 200 with a valid XML sitemap.
 */
export async function checkSitemap(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-sitemap';
  const robots = await loadRobots(env);
  const declared = robots?.sitemaps ?? [];
  const candidates = declared.length > 0 ? declared : ['/sitemap.xml'];
  let first: Probe | null = null;
  // A handful of sitemaps is enough to prove the site has one.
  for (const [index, candidate] of candidates.slice(0, 5).entries()) {
    const probe = await env.probe(candidate);
    if (index === 0) first = probe;
    if (isSitemap(probe)) {
      return result(
        id,
        'discoverability',
        true,
        `${candidate} is a valid XML sitemap.`,
      );
    }
  }
  return result(
    id,
    'discoverability',
    false,
    declared.length > 0
      ? 'No Sitemap listed in robots.txt is a valid XML sitemap.'
      : 'robots.txt lists no Sitemap and /sitemap.xml is not a valid sitemap.',
    evidenceFor(
      env,
      candidates[0],
      first,
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${env.origin}/</loc></url>\n</urlset>`,
    ),
  );
}

/** The AI crawlers the scanner looks for (lower-case user-agent tokens). */
export const AI_BOTS: readonly string[] = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'PerplexityBot',
  'Perplexity-User',
  'Bytespider',
  'Amazonbot',
  'Applebot-Extended',
  'cohere-ai',
  'Meta-ExternalAgent',
  'Meta-ExternalFetcher',
  'FacebookBot',
  'Diffbot',
];

/**
 * AI bot rules: a valid robots.txt passes. When it names a known AI crawler
 * the rules are specific; otherwise only the wildcard rules apply, which
 * passes too (as on isitagentready.com) but carries an informational note.
 */
export async function checkAiBotRules(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-ai-bot-rules';
  const robots = await loadRobots(env);
  const probe = await env.probe('/robots.txt');
  if (!robots) {
    return result(
      id,
      'bot-access',
      false,
      `${missingReason('/robots.txt', probe)}.`,
      robotsEvidence(env, probe),
    );
  }
  if (robots.userAgents.length === 0) {
    return result(
      id,
      'bot-access',
      false,
      '/robots.txt has no User-agent directive.',
      robotsEvidence(env, probe),
    );
  }
  const known = new Set(AI_BOTS.map((bot) => bot.toLowerCase()));
  const named = robots.userAgents.filter((agent) =>
    known.has(agent.toLowerCase()),
  );
  if (named.length > 0) {
    return result(
      id,
      'bot-access',
      true,
      `robots.txt has rules for ${[...new Set(named)].join(', ')}.`,
    );
  }
  // isitagentready.com passes a valid robots.txt whose wildcard rules apply
  // to AI bots; the hint adds an informational note.
  return {
    ...result(
      id,
      'bot-access',
      true,
      `Checked ${AI_BOTS.length} AI bot user agents -- none found, but wildcard rules apply.`,
      evidenceFor(
        env,
        '/robots.txt',
        probe,
        'User-agent: GPTBot\nDisallow: /private/',
      ),
    ),
    note: true,
  };
}

/** The three signals defined by contentsignals.org. */
const CONTENT_SIGNALS: ReadonlySet<string> = new Set([
  'ai-train',
  'search',
  'ai-input',
]);

/** Parses `ai-train=no, search=yes` into valid signal/value pairs. */
export function parseContentSignal(value: string): Record<string, boolean> {
  const signals: Record<string, boolean> = {};
  for (const part of value.split(',')) {
    const match = /^\s*([a-z-]+)\s*=\s*(yes|no)\s*$/i.exec(part);
    if (match && CONTENT_SIGNALS.has(match[1].toLowerCase())) {
      signals[match[1].toLowerCase()] = match[2].toLowerCase() === 'yes';
    }
  }
  return signals;
}

/**
 * Content Signals: robots.txt carries a `Content-Signal` directive with at
 * least one valid `ai-train`, `search` or `ai-input` value.
 */
export async function checkContentSignals(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-content-signals';
  const robots = await loadRobots(env);
  const probe = await env.probe('/robots.txt');
  if (!robots) {
    return result(
      id,
      'bot-access',
      false,
      `${missingReason('/robots.txt', probe)}.`,
      robotsEvidence(env, probe, true),
    );
  }
  for (const value of robots.contentSignals) {
    const signals = parseContentSignal(value);
    if (Object.keys(signals).length > 0) {
      return result(
        id,
        'bot-access',
        true,
        `robots.txt declares Content-Signal: ${value}.`,
      );
    }
  }
  return result(
    id,
    'bot-access',
    false,
    robots.contentSignals.length > 0
      ? 'The Content-Signal directive has no valid ai-train, search or ai-input value.'
      : 'robots.txt has no Content-Signal directive.',
    robots.contentSignals.length > 0
      ? {
          resource: probe?.url ?? urlOf(env, '/robots.txt'),
          snippet: `Content-Signal: ${robots.contentSignals[0]}`,
        }
      : evidenceFor(
          env,
          '/robots.txt',
          probe,
          'User-agent: *\nContent-Signal: ai-train=no, search=yes, ai-input=no',
        ),
  );
}
