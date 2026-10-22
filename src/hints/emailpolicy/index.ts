import type { HintDefinition } from '../../core/define-hint.js';
import bimi from './bimi.js';
import mtaSts from './mta-sts.js';
import tlsRpt from './tls-rpt.js';

/**
 * Hints of the `emailpolicy` set: the RFC-backed email-authentication policies
 * published in DNS (and, for MTA-STS, over HTTPS) — MTA-STS (RFC 8461),
 * TLS-RPT (RFC 8460) and BIMI — for the scanned site's mail domain.
 */
export const emailpolicyHints: readonly HintDefinition[] = [
  mtaSts,
  tlsRpt,
  bimi,
];
