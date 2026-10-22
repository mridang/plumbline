import type { HintContext } from 'hint';
import { Severity } from '@hint/utils-types';
import { onSite } from '../../core/page.js';
import {
  resourceFor,
  targetFor,
  type TlsTarget,
} from '../../lib/tls/client.js';

/**
 * The words a finding uses for what is being tested, so one check serves the
 * website (HTTPS) and the mail servers (SMTP STARTTLS) with the wording
 * Internet.nl uses for each.
 */
export interface TlsSubject {
  /** The server, for example `web server`. */
  server: string;
  /** The certificate, for example `website certificate`. */
  certificate: string;
  /** What the host name identifies, for example `website`. */
  owner: string;
}

/** The wording for the scanned website. */
const WEB_SUBJECT: TlsSubject = {
  server: 'web server',
  certificate: 'website certificate',
  owner: 'website',
};

/** The wording for a receiving mail server (MX). */
export const MAIL_SUBJECT: TlsSubject = {
  server: 'mail server',
  certificate: 'mail server certificate',
  owner: 'mail server',
};

/** What a TLS hint gets: the target and ways to report against it. */
export interface TlsSite {
  target: TlsTarget;
  /** How findings name the tested server and its certificate. */
  subject: TlsSubject;
  /**
   * Reports a failed rule (an error unless told otherwise) with the evidence
   * it rests on, shown as the code snippet of the finding.
   */
  report(message: string, codeSnippet: string, severity?: Severity): void;
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
      subject: WEB_SUBJECT,
      report: (message, codeSnippet, severity = Severity.error) =>
        site.report(resource, message, { severity, codeSnippet }),
      couldNotTest: (reason) =>
        site.report(resource, `Could not test: ${reason}.`, {
          severity: Severity.hint,
          codeSnippet: `${target.host}:${target.port}`,
        }),
    });
  });
}
