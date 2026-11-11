/**
 * NodeInfo exposes metadata about a Fediverse server (software, version, usage)
 * through a discovery document at `/.well-known/nodeinfo`. That document is a
 * JSON object with a `links` array, each entry naming a NodeInfo schema `rel`
 * and the `href` where that schema's document lives. The check validates the
 * links document when present and is silent when it is absent.
 *
 * Source: the NodeInfo protocol (https://nodeinfo.diaspora.software/protocol.html).
 */
import { finding, type Finding } from '../headers/finding.js';

/** The response observed when fetching the discovery document. */
export interface NodeinfoResponse {
  statusCode: number;
  body: string;
}

/** True for a links entry that names both a schema rel and a target href. */
function isLink(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const link = value as Record<string, unknown>;
  return typeof link.rel === 'string' && typeof link.href === 'string';
}

/** Evaluates a fetch of `/.well-known/nodeinfo`. */
export function nodeinfoFindings(response: NodeinfoResponse | null): Finding[] {
  if (response === null || response.statusCode === 404) {
    return [];
  }
  if (response.statusCode !== 200) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    return [
      finding(
        'warning',
        'The /.well-known/nodeinfo document is not valid JSON.',
      ),
    ];
  }
  const links =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>).links
      : undefined;
  if (!Array.isArray(links) || links.length === 0) {
    return [
      finding(
        'warning',
        "The /.well-known/nodeinfo document must carry a non-empty 'links' array.",
      ),
    ];
  }
  if (!links.every((link) => isLink(link))) {
    return [
      finding(
        'warning',
        "Every /.well-known/nodeinfo link must have a 'rel' and an 'href'.",
      ),
    ];
  }
  return [
    finding('hint', 'A Fediverse NodeInfo discovery document is present.'),
  ];
}
