import type { Problem } from '@hint/utils-types';
import type { DnsClient } from '../../../src/core/dns.js';
import type { HintDefinition } from '../../../src/core/define-hint.js';
import {
  pointAtMail,
  restoreProbe,
  startMailServer,
  type LocalMailServerOptions,
} from '../tls/local-server.js';
import { fakeDns, runMailHint } from './fakes.js';

/**
 * One mail server named by its IP address, so the TLS probes reach the local
 * test server: a real MX name could not be resolved without the internet.
 */
const LOCAL_MX = fakeDns({ 'example.test MX': ['10 127.0.0.1.'] });

/** Runs a mail TLS hint against a local mail server and returns the problems. */
export async function scanMail(
  hint: HintDefinition,
  options: LocalMailServerOptions = {},
  trusted = true,
  dns: DnsClient = LOCAL_MX,
): Promise<Problem[]> {
  const server = await startMailServer(options);
  pointAtMail(server.port, trusted);
  try {
    return await runMailHint(hint, { dns });
  } finally {
    await server.close();
    restoreProbe();
  }
}

/** Runs a mail TLS hint while nothing listens on the mail port. */
export async function scanClosedMail(
  hint: HintDefinition,
): Promise<{ problems: Problem[]; port: number }> {
  const server = await startMailServer();
  const { port } = server;
  await server.close();
  pointAtMail(port);
  try {
    return {
      problems: await runMailHint(hint, { dns: LOCAL_MX }),
      port,
    };
  } finally {
    restoreProbe();
  }
}
