import { describe, expect, it } from '@jest/globals';
import { parseDmarc } from '../../../src/lib/email/dmarc.js';

describe('parseDmarc', () => {
  it.each([
    'v=DMARC1; p=reject',
    'v=DMARC1;p=none',
    'v=DMARC1; p=reject;',
    'v=DMARC1; p=reject; ',
    'V = DMARC1 ; p = quarantine ; pct = 50',
    'v=DMARC1; p=reject; sp=none; np=reject; psd=n; t=y',
    'v=DMARC1; p=reject; rua=mailto:a@example.com, mailto:b@example.com!10m',
    'v=DMARC1; p=reject; ruf=mailto:f@example.com; fo=0:1:d:s; rf=afrf',
    'v=DMARC1; p=reject; adkim=s; aspf=r; ri=86400; pct=100',
    'v=DMARC1; p=reject; rua=https://reports.example.com/dmarc',
    'v=DMARC1;',
    'v=DMARC1; ',
    'v=DMARC1; sp=reject',
  ])('accepts %s', (record) => {
    expect(parseDmarc(record)).not.toBeNull();
  });

  it.each([
    ['not dmarc', 'hello'],
    ['lowercase version value', 'v=dmarc1; p=reject'],
    ['no separator after version', 'v=DMARC1 p=reject'],
    ['p not first', 'v=DMARC1; sp=reject; p=reject'],
    ['unknown tag', 'v=DMARC1; p=reject; foo=bar'],
    ['repeated tag', 'v=DMARC1; p=reject; pct=1; pct=2'],
    ['bad policy', 'v=DMARC1; p=allow'],
    ['empty tag', 'v=DMARC1; p=reject;; pct=1'],
    ['tag without value', 'v=DMARC1; p'],
    ['bad flag', 'v=DMARC1; p=reject; t=maybe'],
    ['bad psd', 'v=DMARC1; p=reject; psd=x'],
    ['bad alignment', 'v=DMARC1; p=reject; adkim=x'],
    ['bad interval', 'v=DMARC1; p=reject; ri=soon'],
    ['bad fo', 'v=DMARC1; p=reject; fo=2'],
    ['bad rf', 'v=DMARC1; p=reject; rf=bad-'],
    ['bad pct', 'v=DMARC1; p=reject; pct=1000'],
    ['uri without scheme', 'v=DMARC1; p=reject; rua=a@example.com'],
    ['uri with two bangs', 'v=DMARC1; p=reject; rua=mailto:a@b.com!1!2'],
    ['uri with bad size', 'v=DMARC1; p=reject; rua=mailto:a@b.com!big'],
    ['empty uri', 'v=DMARC1; p=reject; rua=mailto:a@b.com,'],
    ['tab whitespace', 'v=DMARC1;\tp=reject'],
  ])('rejects %s', (_name, record) => {
    expect(parseDmarc(record)).toBeNull();
  });

  it('returns the directives', () => {
    const parsed = parseDmarc(
      'v=DMARC1; p=Reject; sp=none; rua=mailto:a@b.com, mailto:c@d.com; t=Y; fo=0:1; pct=50',
    );
    expect(parsed?.directives).toEqual({
      request: 'reject',
      srequest: 'none',
      auri: ['mailto:a@b.com', 'mailto:c@d.com'],
      testing: 'y',
      fo: ['0', '1'],
      percent: '50',
    });
  });

  it('gives empty directives for a bare version', () => {
    expect(parseDmarc('v=DMARC1;')?.directives).toEqual({});
  });
});
