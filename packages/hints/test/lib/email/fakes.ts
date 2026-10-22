import type { Problem } from '@hint/utils-types';
import type { HintDefinition } from '../../../src/core/define-hint.js';
import { runHint } from '../../helpers/run-hint.js';
import {
  dns,
  type DnsClient,
  type DnsResponse,
} from '../../../src/core/dns.js';
import { rpki, type RpkiClient } from '../../../src/core/rpki.js';
import { mailNet, type MailNetClient } from '../../../src/lib/email/net.js';

/** Record type numbers by name, as DNS answers carry them. */
const TYPE_NUMBERS: Record<string, number> = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  TLSA: 52,
  CAA: 257,
};

/** What a fake zone answers for one `<name> <type>` key. */
export type FakeAnswer =
  | string[]
  | {
      status?: number;
      authenticated?: boolean;
      /** Record data in presentation format. */
      data?: string[];
    };

/**
 * Builds a DNS client from a table keyed by `<name> <type>`, for example
 * `'example.com MX'`. A key that is missing answers NOERROR with no data. A
 * plain array lists the record data of an unsigned answer.
 */
export function fakeDns(table: Record<string, FakeAnswer>): DnsClient {
  return {
    query(name, type): Promise<DnsResponse> {
      const entry = table[`${name} ${type}`];
      const spec = Array.isArray(entry) ? { data: entry } : (entry ?? {});
      return Promise.resolve({
        status: spec.status ?? 0,
        authenticated: spec.authenticated ?? false,
        answers: (spec.data ?? []).map((data) => ({
          name,
          type: TYPE_NUMBERS[type],
          ttl: 300,
          data,
        })),
        authority: [],
      });
    },
  };
}

export interface Fakes {
  dns?: DnsClient;
  rpki?: RpkiClient;
  net?: MailNetClient;
}

/** Installs fakes for the real clients and returns a function that restores them. */
export function installFakes(fakes: Fakes): () => void {
  const saved = {
    dns: dns.client,
    rpki: rpki.client,
    net: mailNet.client,
  };
  if (fakes.dns) {
    dns.client = fakes.dns;
  }
  if (fakes.rpki) {
    rpki.client = fakes.rpki;
  }
  if (fakes.net) {
    mailNet.client = fakes.net;
  }
  return () => {
    dns.client = saved.dns;
    rpki.client = saved.rpki;
    mailNet.client = saved.net;
  };
}

/**
 * Runs a mail hint against a local page with the given fakes installed and
 * the checked domain set to `example.test`, then restores the real clients.
 */
export async function runMailHint(
  hint: HintDefinition,
  fakes: Fakes,
  hintOptions: Record<string, unknown> = {},
): Promise<Problem[]> {
  const restore = installFakes(fakes);
  try {
    return await runHint(
      hint,
      {},
      { hintOptions: { domain: 'example.test', ...hintOptions } },
    );
  } finally {
    restore();
  }
}
