import { describe, expect, it } from '@jest/globals';
import type { DnsClient } from '../../../src/core/dns.js';
import { decodeTxt, lookupTxt } from '../../../src/lib/email/txt.js';
import { fakeDns } from './fakes.js';

describe('decodeTxt', () => {
  it('unquotes a single string', () => {
    expect(decodeTxt('"v=spf1 -all"')).toBe('v=spf1 -all');
  });

  it('joins several quoted strings without a separator', () => {
    expect(decodeTxt('"v=DKIM1; p=AB" "CD"')).toBe('v=DKIM1; p=ABCD');
  });

  it('decodes escapes', () => {
    expect(decodeTxt(String.raw`"a\"b\\c\065"`)).toBe(String.raw`a"b\cA`);
  });

  it('returns an unquoted value as is', () => {
    expect(decodeTxt(' v=spf1 -all ')).toBe('v=spf1 -all');
  });
});

describe('lookupTxt', () => {
  it('returns the decoded records', async () => {
    const client = fakeDns({ 'a.test TXT': ['"one"', '"two"'] });
    expect(await lookupTxt(client, 'a.test')).toEqual({
      status: 'ok',
      records: ['one', 'two'],
    });
  });

  it('maps NXDOMAIN', async () => {
    const client = fakeDns({ 'a.test TXT': { status: 3 } });
    expect(await lookupTxt(client, 'a.test')).toEqual({ status: 'nxdomain' });
  });

  it('maps SERVFAIL and thrown errors to error', async () => {
    const servfail = fakeDns({ 'a.test TXT': { status: 2 } });
    expect(await lookupTxt(servfail, 'a.test')).toEqual({ status: 'error' });
    const broken: DnsClient = {
      query: () => Promise.reject(new Error('network down')),
    };
    expect(await lookupTxt(broken, 'a.test')).toEqual({ status: 'error' });
  });
});
