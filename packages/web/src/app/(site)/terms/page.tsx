import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { Container } from '@/components/ui/layout';
import { CONTACT_EMAIL, SOURCE_URL, TERMS_LAST_UPDATED } from '@/utils/site';

import {
  LegalItem,
  LegalLink,
  LegalPage,
  LegalSection,
} from '@/app/(site)/privacy/_components/legal-section';

/**
 * A public page: it may be indexed, and it carries its own social card (the
 * image comes from the site-wide one).
 */
export const metadata: Metadata = pageMetadata({
  title: 'Terms',
  description:
    'The terms for using Plumbline: scan only sites you may test, and take the results as advice.',
  path: '/terms',
  index: true,
});

/**
 * Terms of service, linked from the Google OAuth consent screen. Short and
 * plain, in the same layout as the privacy policy.
 */
export default function TermsPage(): ReactElement {
  return (
    <Container className="py-10 sm:py-16">
      <LegalPage
        eyebrow="Terms"
        title="Terms of Service"
        updated={TERMS_LAST_UPDATED}
      >
        <p>
          Plumbline is a free service that checks websites against public
          references. By using it you agree to these terms. If you don’t, please
          don’t use it.
        </p>

        <LegalSection title="Using Plumbline">
          <ul className="space-y-2">
            <LegalItem>
              Scan sites you own or are allowed to test. A scan reads public
              pages and records, the way a browser does, but the site’s owner
              may still not want it.
            </LegalItem>
            <LegalItem>
              Don’t use Plumbline to attack, overload or get around the
              protections of any site, or to get around Plumbline’s own limits.
              A page can be scanned at most once every five minutes, and the
              server limits how often anyone can call it.
            </LegalItem>
            <LegalItem>
              Keep your Google account secure: you are responsible for what is
              done with your Plumbline account and the assistants you connect to
              it.
            </LegalItem>
          </ul>
        </LegalSection>

        <LegalSection title="The results">
          <p>
            The checks follow public references, and each one links to the rule
            it comes from. Their results are advice, not a guarantee: a site
            that passes every check can still be insecure, and a finding can be
            wrong for your set-up. Decide for yourself before changing anything.
          </p>
        </LegalSection>

        <LegalSection title="The service">
          <p>
            Plumbline is provided as it is, without warranty of any kind. It may
            change, be unavailable or stop at any time, and as far as the law
            allows we are not liable for any loss from using it. We may remove
            an account that breaks these terms.
          </p>
        </LegalSection>

        <LegalSection title="Open source">
          <p>
            Plumbline’s code is open source under the Apache 2.0 licence, and is
            on <LegalLink href={SOURCE_URL}>GitHub</LegalLink>. That licence,
            not these terms, covers the code.
          </p>
        </LegalSection>

        <LegalSection title="Your data">
          <p>
            What Plumbline keeps, and how to delete it, is in the{' '}
            <LegalLink href="/privacy">privacy policy</LegalLink>.
          </p>
        </LegalSection>

        <LegalSection title="Contact">
          <p>{CONTACT_EMAIL}</p>
        </LegalSection>
      </LegalPage>
    </Container>
  );
}
