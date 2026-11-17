import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import {
  acceptedCiphers,
  highestLegacyVersion,
  supportedVersions,
} from '../../lib/tls/client.js';
import { evaluateCiphers } from '../../lib/tls/evaluate.js';
import { onTlsSite } from './on-tls-site.js';
import type { TlsSite } from './on-tls-site.js';

/** Runs the check of the `tls-ciphers` hint against one TLS endpoint. */
export async function checkTlsCiphers({
  target,
  report,
  couldNotTest,
  subject,
}: TlsSite): Promise<void> {
  const versions = await supportedVersions(target);
  const legacy = highestLegacyVersion(versions);
  const probed = [
    ...(legacy ? [legacy] : []),
    ...(versions.includes('TLSv1.3') ? (['TLSv1.3'] as const) : []),
  ];
  if (probed.length === 0) {
    couldNotTest(`no TLS connection to ${target.host}:${target.port}`);
    return;
  }
  const perVersion = await Array.fromAsync(probed, async (version) => {
    const ciphers = await acceptedCiphers(target, version);
    return ciphers.map((cipher) => ({ name: cipher.standardName, version }));
  });
  const accepted = perVersion.flat();
  const names = accepted.map((cipher) => cipher.name);
  // A suite offered on both versions is listed under the later one.
  const offeredOn = new Map(
    accepted.map((cipher) => [cipher.name, cipher.version] as const),
  );
  const lines = (list: string[]): string =>
    list.map((name) => `${offeredOn.get(name)} ${name}`).join('\n');
  const { bad, phaseOut } = evaluateCiphers(names);
  if (bad.length > 0) {
    report(
      `Your ${subject.server} supports one or more *insufficiently* secure cipher suites: ${bad.join(', ')}.`,
      lines(bad),
    );
  }
  if (phaseOut.length > 0) {
    report(
      `Your ${subject.server} supports one or more cipher suites that should be *phased out* as they are weaker, although you might still use them if absolutely needed. In a future update, they will likely become insufficient: ${phaseOut.join(', ')}.`,
      lines(phaseOut),
      Severity.warning,
    );
  }
}

/**
 * Internet.nl "Cipher suites": the server may only accept cipher suites
 * rated good or sufficient (NCSC appendix B, from 3.3.3 and 3.3.4). Phase
 * out suites are advice, anything not in the lists is insufficient.
 *
 * As Internet.nl does, the suites are enumerated for the highest accepted
 * version below TLS 1.3 and for TLS 1.3, by offering all suites, noting
 * which one the server picks, removing it and trying again.
 */
export default defineHint({
  id: 'tls-ciphers',
  name: 'TLS cipher suites',
  description:
    'Requires the HTTPS server to accept only secure (good or sufficient) cipher suites.',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, checkTlsCiphers);
  },
});
