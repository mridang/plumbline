/**
 * The TLS handshakes a scan makes through the prober container.
 *
 *   POST /api/scans/{id}/probes {host, port, starttls?, minVersion?,
 *   maxVersion?, ciphers?, requestOCSP?} → 200, what the handshake showed
 *
 * The behaviour lives in the `scanProbes` controller; this file only mounts it.
 */

import { scanProbes } from '@/domain/api/scans';

export const dynamic = 'force-dynamic';

export const { POST } = scanProbes.handlers();
