import type { HintContext } from 'hint';
import { Severity } from '@hint/utils-types';
import { onSite } from '../../core/page.js';
import {
  resourceFor,
  targetFor,
  type TlsTarget,
} from '../../lib/tls/client.js';

/** What a TLS hint gets: the target and ways to report against it. */
export interface TlsSite {
  target: TlsTarget;
  /** Reports a failed rule (an error unless told otherwise). */
  report(message: string, severity?: Severity): void;
  /** Reports that the check could not be made, as information. */
  couldNotTest(reason: string): void;
}

/**
 * Runs `check` after the scan for the HTTPS port of the scanned host. All
 * TLS hints of this set use it so they target the host the same way and
 * report "could not test" the same way.
 */
export function onTlsSite(
  context: HintContext,
  check: (site: TlsSite) => void | Promise<void>,
): void {
  onSite(context, async (site) => {
    const target = targetFor(site.url);
    const resource = resourceFor(target);
    await check({
      target,
      report: (message, severity = Severity.error) =>
        site.report(resource, message, { severity }),
      couldNotTest: (reason) =>
        site.report(resource, `Could not test: ${reason}.`, {
          severity: Severity.hint,
        }),
    });
  });
}
