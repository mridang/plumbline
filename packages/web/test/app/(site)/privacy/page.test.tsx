import { describe, expect, it } from '@jest/globals';

import PrivacyPage, { metadata } from '@/app/(site)/privacy/page';
import { html } from '../../../components/render';

describe('PrivacyPage', () => {
  const out = html(<PrivacyPage />);

  it('has one heading, the policy’s title', () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>Privacy Policy<\/h1>/);
  });

  it('says when it last changed', () => {
    expect(out).toContain('Last updated: 1 November 2026');
  });

  it('states what is accessed, what is stored and what is not done', () => {
    for (const heading of [
      'What we access',
      'What we store',
      'Scanning a site',
      'Connected assistants',
      'Cookies and logs',
      'What we don’t do',
      'Deleting your data',
      'Contact',
    ]) {
      expect(out).toMatch(new RegExp(`<h2[^>]*>${heading}</h2>`));
    }
  });

  it('asks Google only for basic identity', () => {
    expect(out).toContain('basic identity (name,');
    expect(out).toContain('no access to your Gmail, Drive');
  });

  it('says the checks run on the server and unsaved scans are not kept', () => {
    expect(out).toContain('The checks run on Plumbline’s servers');
    expect(out).toContain('A scan you run without saving it is not stored');
  });

  it('says a scanned page’s address is kept for five minutes', () => {
    expect(out).toContain('For five minutes after a page is scanned');
  });

  it('describes connected assistants and where to disconnect them', () => {
    expect(out).toContain('consent screen');
    expect(out).toContain('disconnect any of them');
  });

  it('names the session cookie and says there are no tracking cookies', () => {
    expect(out).toContain('plumbline_session');
    expect(out).toContain('No advertising or analytics cookies');
  });

  it('mentions Cloudflare’s request logs', () => {
    expect(out).toContain(
      'Cloudflare, which hosts Plumbline, records each request',
    );
  });

  it('says what disconnecting GitHub does and how to delete the account', () => {
    expect(out).toContain(
      'Disconnecting GitHub forgets the connection and the repositories found',
    );
    expect(out).toContain('email us from the address you sign in with');
  });

  it('sends people to Google to remove access, in a new tab', () => {
    expect(out).toMatch(
      /<a [^>]*href="https:\/\/myaccount\.google\.com\/permissions"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>your Google account permissions<\/a>/,
    );
  });

  it('gives the contact address', () => {
    expect(out).toContain('mridang.agarwalla@gmail.com');
  });

  it('links back home', () => {
    expect(out).toMatch(/<a [^>]*href="\/"[^>]*>.*Back to Plumbline<\/a>/);
  });
});

describe('the privacy page’s metadata', () => {
  it('may be indexed, unlike most pages', () => {
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe('/privacy');
  });

  it('has its own social card', () => {
    expect(metadata.openGraph?.url).toBe('/privacy');
    expect(metadata.title).toBe('Privacy');
    expect(metadata.twitter?.title).toBe('Privacy · Plumbline');
  });
});
