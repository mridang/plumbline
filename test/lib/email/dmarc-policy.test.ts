import { describe, expect, it } from '@jest/globals';
import { parseDmarc } from '../../../src/lib/email/dmarc.js';
import {
  checkDmarcPolicy,
  reportHosts,
  verifySufficientPolicy,
} from '../../../src/lib/email/dmarc-policy.js';
import type { TxtLookup } from '../../../src/lib/email/txt.js';

const parsed = (record: string) => parseDmarc(record);

describe('verifySufficientPolicy', () => {
  it('flags an unparsable record', () => {
    expect(verifySufficientPolicy(null, false)).toBe('invalid_syntax');
  });

  it.each(['quarantine', 'reject'])('accepts p=%s', (policy) => {
    expect(verifySufficientPolicy(parsed(`v=DMARC1; p=${policy}`), false)).toBe(
      'valid',
    );
  });

  it('rejects p=none and a missing p', () => {
    expect(verifySufficientPolicy(parsed('v=DMARC1; p=none'), false)).toBe(
      'invalid_p_sp',
    );
    expect(verifySufficientPolicy(parsed('v=DMARC1;'), false)).toBe(
      'invalid_p_sp',
    );
    expect(verifySufficientPolicy(parsed('v=DMARC1; sp=reject'), false)).toBe(
      'invalid_p_sp',
    );
  });

  it('lowers the policy one level in test mode', () => {
    expect(
      verifySufficientPolicy(parsed('v=DMARC1; p=quarantine; t=y'), false),
    ).toBe('invalid_p_sp');
    expect(
      verifySufficientPolicy(parsed('v=DMARC1; p=reject; t=y'), false),
    ).toBe('valid');
    expect(
      verifySufficientPolicy(parsed('v=DMARC1; p=quarantine; t=n'), false),
    ).toBe('valid');
  });

  it('prefers sp for an organizational domain', () => {
    expect(
      verifySufficientPolicy(parsed('v=DMARC1; p=reject; sp=none'), true),
    ).toBe('invalid_p_sp');
    expect(
      verifySufficientPolicy(parsed('v=DMARC1; p=none; sp=reject'), true),
    ).toBe('valid');
    expect(verifySufficientPolicy(parsed('v=DMARC1; p=reject'), true)).toBe(
      'valid',
    );
    expect(verifySufficientPolicy(parsed('v=DMARC1;'), true)).toBe(
      'invalid_p_sp',
    );
  });
});

describe('reportHosts', () => {
  it('extracts hosts of rua and ruf', () => {
    const record = parsed(
      'v=DMARC1; p=reject; rua=mailto:a@One.com!10m, mailto:b@two.com.; ruf=mailto:c@three.com',
    );
    expect(reportHosts(record!)).toEqual(['one.com', 'two.com', 'three.com']);
  });

  it('skips URIs with an authority', () => {
    const record = parsed('v=DMARC1; p=reject; rua=https://x.com/report');
    expect(reportHosts(record!)).toEqual([]);
  });
});

describe('checkDmarcPolicy', () => {
  const lookups =
    (table: Record<string, TxtLookup>) =>
    (name: string): Promise<TxtLookup> =>
      Promise.resolve(table[name] ?? { status: 'nxdomain' });

  it('accepts a strict record with internal destinations', async () => {
    const status = await checkDmarcPolicy(
      'v=DMARC1; p=reject; rua=mailto:r@mail.example.com',
      'example.com',
      false,
      lookups({}),
    );
    expect(status).toBe('valid');
  });

  it('accepts an authorised external destination', async () => {
    const status = await checkDmarcPolicy(
      'v=DMARC1; p=reject; rua=mailto:r@vendor.net',
      'example.com',
      false,
      lookups({
        'example.com._report._dmarc.vendor.net': {
          status: 'ok',
          records: ['v=DMARC1;'],
        },
      }),
    );
    expect(status).toBe('valid');
  });

  it('flags an unauthorised external destination', async () => {
    const status = await checkDmarcPolicy(
      'v=DMARC1; p=reject; ruf=mailto:r@vendor.net',
      'example.com',
      false,
      lookups({}),
    );
    expect(status).toBe('invalid_external');
  });

  it('flags two authorisation records and a failed lookup', async () => {
    const two = await checkDmarcPolicy(
      'v=DMARC1; p=reject; rua=mailto:r@vendor.net',
      'example.com',
      false,
      lookups({
        'example.com._report._dmarc.vendor.net': {
          status: 'ok',
          records: ['v=DMARC1;', 'v=DMARC1; p=none'],
        },
      }),
    );
    expect(two).toBe('invalid_external');
    const failed = await checkDmarcPolicy(
      'v=DMARC1; p=reject; rua=mailto:r@vendor.net',
      'example.com',
      false,
      lookups({
        'example.com._report._dmarc.vendor.net': { status: 'error' },
      }),
    );
    expect(failed).toBe('invalid_external');
  });

  it('reports syntax and policy before destinations', async () => {
    expect(
      await checkDmarcPolicy(
        'v=DMARC1; p=bogus',
        'example.com',
        false,
        lookups({}),
      ),
    ).toBe('invalid_syntax');
    expect(
      await checkDmarcPolicy(
        'v=DMARC1; p=none; rua=mailto:r@vendor.net',
        'example.com',
        false,
        lookups({}),
      ),
    ).toBe('invalid_p_sp');
  });
});
