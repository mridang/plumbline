import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { Container } from '@/components/ui/layout';
import { CONTACT_EMAIL, PRIVACY_LAST_UPDATED } from '@/utils/site';

import {
  LegalCode,
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
  title: 'Privacy',
  description:
    'What Plumbline stores, what it asks Google for, and what a scan sends where.',
  path: '/privacy',
  index: true,
});

/**
 * Privacy policy. Required for publishing the Google OAuth consent screen, and
 * a plain statement of exactly what plumbline keeps. Kept short and concrete,
 * and laid out like chowdown's.
 */
export default function PrivacyPage(): ReactElement {
  return (
    <Container className="py-10 sm:py-16">
      <LegalPage
        eyebrow="Privacy"
        title="Privacy Policy"
        updated={PRIVACY_LAST_UPDATED}
      >
        <p>
          Plumbline checks websites: their security headers, TLS, DNS and email
          set-up, privacy, SEO and agent readiness. You can use it without an
          account. This policy explains what it accesses and keeps.
        </p>

        <LegalSection title="What we access">
          <ul className="space-y-2">
            <LegalItem>
              Only if you sign in: your Google account’s basic identity (name,
              email, profile picture). Signing in asks for nothing else, and
              Plumbline has no access to your Gmail, Drive or any other Google
              data.
            </LegalItem>
          </ul>
        </LegalSection>

        <LegalSection title="What we store">
          <ul className="space-y-2">
            <LegalItem>
              If you sign in: your name, email, profile picture and Google
              account id.
            </LegalItem>
            <LegalItem>
              If you connect GitHub: your GitHub username, the installations of
              the app and the names, default branches and deployment settings of
              the repositories it can see. The sites found there, which
              repositories you hide, the checks you picked for each site, and
              the runs and reports of their checks.
            </LegalItem>
            <LegalItem>
              For each assistant you have connected (see below): its name, what
              you allowed it to do, when you approved it and when it last used
              the connection. We keep sign-in tokens for it only as one-way
              hashes.
            </LegalItem>
            <LegalItem>
              For five minutes after a page is scanned, its address, so the same
              page is not scanned again too soon. This is about the page, not
              about you.
            </LegalItem>
          </ul>
        </LegalSection>

        <LegalSection title="Scanning a site">
          <p>
            The checks run on Plumbline’s servers. Every request they make to
            the site you are checking comes from Plumbline, so that site sees a
            request from Plumbline rather than from your browser. A scan you run
            without saving it is not stored: its results stay in your browser
            and are gone when you leave the page.
          </p>
        </LegalSection>

        <LegalSection title="Connected assistants">
          <p>
            If you connect an AI assistant to Plumbline, you approve it on a
            consent screen first, and choose whether it may only read your sites
            and reports or change them as well. What an assistant does with them
            once you have allowed it is governed by that assistant’s own privacy
            policy. You can see every assistant you have connected, and
            disconnect any of them, from the Connect page; disconnecting ends
            its access immediately.
          </p>
        </LegalSection>

        <LegalSection title="Cookies and logs">
          <ul className="space-y-2">
            <LegalItem>
              One cookie, <LegalCode>plumbline_session</LegalCode>, keeps you
              signed in. It is only readable by our server, is sent only to this
              site, and lasts up to 30 days or until you sign out. Two
              short-lived cookies (ten minutes) are used while you sign in, to
              check that the answer came from the sign-in you started, and to
              bring you back to the right page.
            </LegalItem>
            <LegalItem>
              No advertising or analytics cookies, and no trackers.
            </LegalItem>
            <LegalItem>
              Cloudflare, which hosts Plumbline, records each request (the
              address it came from, the page asked for, the time and the result)
              in logs that we use to keep the service running and secure. They
              are kept for a short time and are not used to profile you.
            </LegalItem>
          </ul>
        </LegalSection>

        <LegalSection title="What we don’t do">
          <p>
            We don’t sell or share your data, show ads, or use anything you keep
            in Plumbline to train any model.
          </p>
        </LegalSection>

        <LegalSection title="Deleting your data">
          <p>
            Disconnecting GitHub forgets the connection and the repositories
            found; the sites and reports already kept stay until you ask us to
            delete them. To delete your account and everything above with it,
            email us from the address you sign in with and we will do it. To
            also withdraw Google’s permission, remove Plumbline at{' '}
            <LegalLink href="https://myaccount.google.com/permissions">
              your Google account permissions
            </LegalLink>
            .
          </p>
        </LegalSection>

        <LegalSection title="Contact">
          <p>{CONTACT_EMAIL}</p>
        </LegalSection>
      </LegalPage>
    </Container>
  );
}
