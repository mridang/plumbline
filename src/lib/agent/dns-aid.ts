import type { DnsType } from '../../core/dns.js';
import type { AgentEnv, CheckResult } from './types.js';
import { result } from './util.js';

/** The record types queried at each `_agents` label. */
const QUERIES: readonly { label: string; types: readonly DnsType[] }[] = [
  { label: '_index', types: ['SVCB', 'HTTPS', 'TXT'] },
  { label: '_a2a', types: ['SVCB', 'HTTPS'] },
  { label: '_mcp', types: ['SVCB', 'HTTPS'] },
];

/**
 * Parameters that make a ServiceMode record useful. draft-mozleywilliams-
 * dnsop-dnsaid-02 lists alpn, port, ipv4hint/ipv6hint, well-known, cap and
 * cap-sha256 (and recommends mandatory=). UNVERIFIED against the draft:
 * `endpoint`, `mcp` and `a2a` are accepted because isitagentready.com looks
 * for them; the draft also names no `_mcp` label (it appears only as an
 * ALPN id) and treats TXT as a non-preferred fallback.
 */
const PARAMS =
  /\b(alpn|port|ipv4hint|ipv6hint|well-known|cap|cap-sha256|ech|endpoint|mcp|a2a)=/i;

/**
 * True for a ServiceMode SVCB/HTTPS record (priority above 0, RFC 9460)
 * that carries parameters such as `alpn` or an endpoint.
 */
export function isServiceModeRecord(data: string): boolean {
  const match = /^(\d+)\s+(\S+)\s*(.*)$/.exec(data.trim());
  if (!match || Number(match[1]) === 0) {
    return false;
  }
  return PARAMS.test(match[3]);
}

/**
 * DNS for AI discovery (DNS-AID): DNS-over-HTTPS finds ServiceMode SVCB or
 * HTTPS records at `_index._agents`, `_a2a._agents` or `_mcp._agents` of the
 * site's host.
 */
export async function checkDnsAid(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-dns-aid';
  const found: string[] = [];
  for (const { label, types } of QUERIES) {
    const name = `${label}._agents.${env.host}`;
    for (const type of types) {
      try {
        const response = await env.dns.query(name, type);
        // TXT only documents the index; SVCB/HTTPS must be ServiceMode.
        const hit = response.answers.some((answer) =>
          type === 'TXT' ? false : isServiceModeRecord(answer.data),
        );
        if (hit) {
          found.push(`${type} ${name}`);
        }
      } catch {
        // A failed lookup counts as "no record".
      }
    }
  }
  return found.length > 0
    ? result(id, 'discoverability', true, `Found ${found.join(', ')}.`)
    : result(
        id,
        'discoverability',
        false,
        `No SVCB or HTTPS record was found under _agents.${env.host}.`,
      );
}
