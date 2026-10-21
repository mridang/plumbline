import type { DnsResponse, DnsType } from '../../core/dns.js';

/**
 * The five categories isitagentready.com groups its checks into. Keep the
 * order: it is the order categories are reported in.
 */
export type AgentCategory =
  'discoverability' | 'content' | 'bot-access' | 'discovery' | 'commerce';

/** The outcome of one check. */
export interface CheckResult {
  /** The hint id of the check, for example `agent-robots-txt`. */
  id: string;
  category: AgentCategory;
  passed: boolean;
  /** One sentence saying what was found (or why nothing was). */
  detail: string;
}

/** A response the scanner got while probing the site. */
export interface Probe {
  /** The URL that was requested. */
  url: string;
  status: number;
  /** Response headers with lower-case names. */
  headers: Record<string, string>;
  /** The media type and parameters of the `content-type` header. */
  contentType: string;
  body: string;
}

/** The part of a DNS client the checks need (satisfied by `dns.client`). */
interface DnsLike {
  query(name: string, type: DnsType): Promise<DnsResponse>;
}

/**
 * Everything a check may use. Checks never reach for globals so they can be
 * unit-tested with a fake environment.
 */
export interface AgentEnv {
  /** Origin of the scanned site, for example `https://example.com`. */
  origin: string;
  /** Host name of the scanned site. */
  host: string;
  /**
   * Fetches a path or absolute URL; null when the request failed. Results
   * are cached so a probe is made once per scan.
   */
  probe(path: string, headers?: Record<string, string>): Promise<Probe | null>;
  dns: DnsLike;
  /** Runs code in the scanned page; undefined when no browser is attached. */
  evaluate?: (code: string) => Promise<unknown>;
}
