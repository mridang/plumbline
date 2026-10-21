import type { AgentEnv, CheckResult } from './types.js';
import { result } from './util.js';

/**
 * Markdown negotiation: `GET /` with `Accept: text/markdown` is answered
 * with a `text/markdown` body (Cloudflare "Markdown for Agents").
 */
export async function checkMarkdownNegotiation(
  env: AgentEnv,
): Promise<CheckResult> {
  const id = 'agent-markdown-negotiation';
  const probe = await env.probe('/', { accept: 'text/markdown' });
  if (probe && /^text\/markdown/i.test(probe.contentType)) {
    // UNVERIFIED: `x-markdown-tokens` is not in Cloudflare's documentation;
    // isitagentready.com reads it as an optional hint of the document size.
    const tokens = probe.headers['x-markdown-tokens'];
    return result(
      id,
      'content',
      true,
      tokens
        ? `The home page returns text/markdown (${tokens} tokens).`
        : 'The home page returns text/markdown.',
    );
  }
  return result(
    id,
    'content',
    false,
    'The home page does not return text/markdown when asked for it.',
  );
}
