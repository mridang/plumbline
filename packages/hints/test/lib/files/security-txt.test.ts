import { describe, expect, it } from '@jest/globals';
import { validateSecurityTxt } from '../../../src/lib/files/security-txt.js';

const now = new Date('2026-01-01T00:00:00Z');
const ok = 'Contact: mailto:s@a.com\nExpires: 2026-06-01T00:00:00Z\n';
const msgs = (t: string, url?: string) =>
  validateSecurityTxt(t, { now, url }).map((i) => i.message);

describe('validateSecurityTxt', () => {
  it('accepts a minimal file', () => {
    expect(msgs(ok)).toEqual([]);
  });
  it('requires Contact and Expires', () => {
    expect(msgs('# nothing')).toEqual([
      "The required 'contact' field is missing.".replace('contact', 'Contact'),
      "The required 'Expires' field is missing.",
    ]);
  });
  it('rejects malformed lines', () => {
    const i = validateSecurityTxt(`${ok}junk`, { now });
    expect(i[0].line).toBe(3);
  });
  it('rejects duplicate Expires', () => {
    expect(msgs(`${ok}Expires: 2026-07-01T00:00:00Z`)[0]).toContain(
      'only once',
    );
  });
  it('rejects non RFC 3339 Expires', () => {
    expect(msgs('Contact: mailto:a@b.c\nExpires: 2026-06-01')[0]).toContain(
      'RFC 3339',
    );
  });
  it('rejects expired files', () => {
    expect(
      msgs('Contact: mailto:a@b.c\nExpires: 2025-06-01T00:00:00Z')[0],
    ).toContain('expired');
  });
  it('warns when Expires is over a year away', () => {
    const i = validateSecurityTxt(
      'Contact: mailto:a@b.c\nExpires: 2028-06-01T00:00:00Z',
      { now },
    );
    expect(i[0].severity).toBe('warning');
  });
  it('rejects http and invalid contact URIs', () => {
    expect(msgs(`${ok}Contact: http://a.com`)[0]).toContain('HTTPS');
    expect(msgs(`${ok}Contact: not a uri`)[0]).toContain('not a valid URI');
    expect(msgs(`${ok}Contact: ftp://a.com`)[0]).toContain("scheme 'ftp'");
  });
  it('accepts tel and https contacts', () => {
    expect(
      msgs(`${ok}Contact: tel:+1-201-555-0123\nContact: https://a.com/c`),
    ).toEqual([]);
  });
  it('validates other URI fields', () => {
    expect(msgs(`${ok}Policy: http://a.com/p`)[0]).toContain('HTTPS');
    expect(msgs(`${ok}Encryption: openpgp4fpr:abc`)).toEqual([]);
    expect(msgs(`${ok}Hiring: mailto:a@b.c`)[0]).toContain("scheme 'mailto'");
  });
  it('validates Preferred-Languages', () => {
    expect(msgs(`${ok}Preferred-Languages: en, nl`)).toEqual([]);
    expect(msgs(`${ok}Preferred-Languages: english!`)[0]).toContain(
      'language tags',
    );
    expect(
      msgs(`${ok}Preferred-Languages: en\nPreferred-Languages: nl`)[0],
    ).toContain('only once');
  });
  it('checks Canonical against the URL', () => {
    const url = 'https://a.com/.well-known/security.txt';
    expect(msgs(`${ok}Canonical: ${url}`, url)).toEqual([]);
    expect(
      msgs(`${ok}Canonical: https://b.com/.well-known/security.txt`, url)[0],
    ).toContain('Canonical');
  });
  it('handles a clearsigned file', () => {
    const signed = `-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA512\n\n${ok}-----BEGIN PGP SIGNATURE-----\nabc\n-----END PGP SIGNATURE-----\n`;
    expect(msgs(signed)).toEqual([]);
  });
  it('reports an unterminated signature and a malformed envelope', () => {
    const open = `-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA512\n\n${ok}-----BEGIN PGP SIGNATURE-----\nabc\n`;
    expect(msgs(open)[0]).toContain('not terminated');
    expect(msgs('-----BEGIN PGP SIGNED MESSAGE-----\n' + ok)[0]).toContain(
      'malformed',
    );
  });
  it('warns on files over 100 KiB', () => {
    expect(msgs(`${ok}# ${'x'.repeat(101 * 1024)}`)[0]).toContain('100 KiB');
  });
});
