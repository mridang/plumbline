import { describe, expect, it } from '@jest/globals';
import type { TxtLookup } from '../../../src/lib/email/txt.js';
import { checkTlsRpt } from '../../../src/lib/emailpolicy/tls-rpt.js';
import { HTTP_SCHEME } from '../../helpers/data.js';

const ok = (records: string[]): TxtLookup => ({ status: 'ok', records });

describe('checkTlsRpt', () => {
  it('passes a record with a mailto destination', () => {
    expect(
      checkTlsRpt(
        'example.test',
        ok(['v=TLSRPTv1; rua=mailto:tls@example.test']),
      ),
    ).toEqual([]);
  });

  it('passes a record with an https destination', () => {
    expect(
      checkTlsRpt(
        'example.test',
        ok(['v=TLSRPTv1; rua=https://reports.example.test/tls']),
      ),
    ).toEqual([]);
  });

  it('passes a record with several destinations', () => {
    expect(
      checkTlsRpt(
        'example.test',
        ok([
          'v=TLSRPTv1; rua=mailto:a@example.test,https://reports.example.test/tls',
        ]),
      ),
    ).toEqual([]);
  });

  it('is silent when the lookup failed', () => {
    expect(checkTlsRpt('example.test', { status: 'error' })).toEqual([]);
  });

  it('advises once when no record is published', () => {
    const findings = checkTlsRpt('example.test', ok([]));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].message).toContain(
      'does *not* publish a TLS-RPT record',
    );
  });

  it('advises when the name does not exist', () => {
    expect(
      checkTlsRpt('example.test', { status: 'nxdomain' })[0].severity,
    ).toBe('warning');
  });

  it('errors on more than one record', () => {
    const records = [
      'v=TLSRPTv1; rua=mailto:a@example.test',
      'v=TLSRPTv1; rua=mailto:b@example.test',
    ];
    const findings = checkTlsRpt('example.test', ok(records));
    expect(findings[0].message).toContain('*more than one*');
    expect(findings[0].codeSnippet).toBe(records.join('\n'));
  });

  it('errors when the record has the wrong version', () => {
    expect(
      checkTlsRpt(
        'example.test',
        ok(['v=TLSRPTv2; rua=mailto:tls@example.test']),
      )[0].message,
    ).toContain('must start with `v=TLSRPTv1`');
  });

  it('errors when rua is missing', () => {
    expect(
      checkTlsRpt('example.test', ok(['v=TLSRPTv1']))[0].message,
    ).toContain('*no* `rua` destination');
  });

  it('errors when rua is empty', () => {
    expect(
      checkTlsRpt('example.test', ok(['v=TLSRPTv1; rua=']))[0].message,
    ).toContain('*no* `rua` destination');
  });

  it('errors on a destination that is neither mailto nor https', () => {
    const findings = checkTlsRpt(
      'example.test',
      ok([`v=TLSRPTv1; rua=${HTTP_SCHEME}insecure.test/r`]),
    );
    expect(findings[0].message).toContain(
      'must be a `mailto:` or `https:` URI',
    );
    expect(findings[0].codeSnippet).toBe(`rua=${HTTP_SCHEME}insecure.test/r`);
  });

  it('errors on a mailto without an address', () => {
    expect(
      checkTlsRpt('example.test', ok(['v=TLSRPTv1; rua=mailto:']))[0].message,
    ).toContain('must be a `mailto:` or `https:` URI');
  });
});
