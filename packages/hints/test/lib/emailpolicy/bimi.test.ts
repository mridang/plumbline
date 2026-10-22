import { describe, expect, it } from '@jest/globals';
import type { TxtLookup } from '../../../src/lib/email/txt.js';
import { checkBimi } from '../../../src/lib/emailpolicy/bimi.js';

const ok = (records: string[]): TxtLookup => ({ status: 'ok', records });

describe('checkBimi', () => {
  it('notes a valid record with an https svg logo', () => {
    const findings = checkBimi(
      'example.test',
      ok(['v=BIMI1; l=https://example.test/logo.svg']),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('hint');
    expect(findings[0].message).toContain('must also enforce DMARC');
  });

  it('notes a valid record with an https certificate', () => {
    const findings = checkBimi(
      'example.test',
      ok([
        'v=BIMI1; l=https://example.test/logo.svg; a=https://example.test/vmc.pem',
      ]),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('hint');
  });

  it('accepts an svg url with a query string', () => {
    expect(
      checkBimi(
        'example.test',
        ok(['v=BIMI1; l=https://example.test/logo.svg?v=2']),
      )[0].severity,
    ).toBe('hint');
  });

  it('is silent when the lookup failed', () => {
    expect(checkBimi('example.test', { status: 'error' })).toEqual([]);
  });

  it('advises once when no record is published', () => {
    const findings = checkBimi('example.test', ok([]));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].message).toContain('does *not* publish a BIMI record');
  });

  it('treats an empty l and a as a valid declination', () => {
    const findings = checkBimi('example.test', ok(['v=BIMI1; l=; a=']));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('hint');
    expect(findings[0].message).toContain('valid declination');
  });

  it('errors on more than one record', () => {
    const records = [
      'v=BIMI1; l=https://a.test/l.svg',
      'v=BIMI1; l=https://b.test/l.svg',
    ];
    expect(checkBimi('example.test', ok(records))[0].message).toContain(
      '*more than one*',
    );
  });

  it('errors when the record has the wrong version', () => {
    expect(
      checkBimi(
        'example.test',
        ok(['v=BIMI2; l=https://example.test/logo.svg']),
      )[0].message,
    ).toContain('must start with `v=BIMI1`');
  });

  it('errors when l is present but a is empty and l is missing', () => {
    const findings = checkBimi(
      'example.test',
      ok(['v=BIMI1; a=https://example.test/vmc.pem']),
    );
    expect(findings.some((f) => f.message.includes('*no* `l` logo URL'))).toBe(
      true,
    );
  });

  it('errors on a non-https logo url', () => {
    const findings = checkBimi(
      'example.test',
      ok(['v=BIMI1; l=http://example.test/logo.svg']),
    );
    expect(findings[0].message).toContain(
      '`l` logo URL must be served over `https:`',
    );
  });

  it('errors on a logo url that is not an svg', () => {
    const findings = checkBimi(
      'example.test',
      ok(['v=BIMI1; l=https://example.test/logo.png']),
    );
    expect(findings[0].message).toContain('must point to an SVG file');
  });

  it('errors on a non-https certificate url', () => {
    const findings = checkBimi(
      'example.test',
      ok([
        'v=BIMI1; l=https://example.test/logo.svg; a=http://example.test/vmc.pem',
      ]),
    );
    expect(
      findings.some((f) =>
        f.message.includes('`a` certificate URL must be served over `https:`'),
      ),
    ).toBe(true);
  });
});
