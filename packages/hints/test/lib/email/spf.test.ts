import { describe, expect, it } from '@jest/globals';
import { isValidDomainSpec, parseSpf } from '../../../src/lib/email/spf.js';

const kinds = (record: string) => parseSpf(record)?.terms.map((t) => t.kind);

describe('parseSpf', () => {
  it.each([
    'v=spf1',
    'v=spf1 -all',
    'V=SPF1 -ALL',
    'v=spf1 +all',
    'v=spf1  ~all  ',
    'v=spf1 mx a ip4:192.0.2.0/24 ip6:2001:db8::/32 -all',
    'v=spf1 a:mail.example.com mx:example.com/24 a/24//64 mx//64 -all',
    'v=spf1 include:_spf.example.com ?all',
    'v=spf1 exists:%{i}._spf.%{d2} -all',
    'v=spf1 ptr ptr:example.com -all',
    'v=spf1 redirect=_spf.example.com',
    'v=spf1 -all exp=explain.example.com',
    'v=spf1 custom=value -all',
    'v=spf1 ip4:192.0.2.1 ip6:::1 -all',
    'v=spf1 include:example.com. -all',
  ])('accepts %s', (record) => {
    expect(parseSpf(record)).not.toBeNull();
  });

  it.each([
    ['not spf', 'hello world'],
    ['version without space', 'v=spf1-all'],
    ['wrong version', 'v=spf2 -all'],
    ['unknown mechanism', 'v=spf1 foo -all'],
    ['qualifier on modifier', 'v=spf1 -redirect=example.com'],
    ['include without domain', 'v=spf1 include: -all'],
    ['include without colon', 'v=spf1 include -all'],
    ['bad ip4 octet', 'v=spf1 ip4:256.0.0.1 -all'],
    ['bad ip4 length', 'v=spf1 ip4:192.0.2.0/33 -all'],
    ['incomplete ip4', 'v=spf1 ip4:192.0.2 -all'],
    ['bad ip6', 'v=spf1 ip6:nonsense -all'],
    ['bad ip6 length', 'v=spf1 ip6:2001:db8::/129 -all'],
    ['bad toplabel', 'v=spf1 include:example.-- -all'],
    ['numeric toplabel', 'v=spf1 include:example.123 -all'],
    ['bad macro', 'v=spf1 exists:%{z}.example.com -all'],
    ['lone percent', 'v=spf1 exists:50%.example.com -all'],
    ['a with garbage', 'v=spf1 abc -all'],
    ['tab separator', 'v=spf1\t-all'],
    ['bad cidr', 'v=spf1 a/33 -all'],
  ])('rejects %s', (_name, record) => {
    expect(parseSpf(record)).toBeNull();
  });

  it('classifies terms', () => {
    expect(
      kinds(
        'v=spf1 a mx ptr ip4:192.0.2.1 ip6:::1 exists:x.com include:y.com custom=1 redirect=z.com exp=e.com -all',
      ),
    ).toEqual([
      'a',
      'mx',
      'ptr',
      'ip4',
      'ip6',
      'exists',
      'include',
      'modifier',
      'redirect',
      'exp',
      'all',
    ]);
  });

  it('keeps qualifier and value', () => {
    const [term] = parseSpf('v=spf1 ~include:_spf.example.com')?.terms ?? [];
    expect(term).toEqual({
      raw: '~include:_spf.example.com',
      kind: 'include',
      qualifier: '~',
      value: '_spf.example.com',
    });
  });

  it('has no qualifier for a bare mechanism', () => {
    expect(parseSpf('v=spf1 all')?.terms[0].qualifier).toBeNull();
  });
});

describe('isValidDomainSpec', () => {
  it('requires a toplabel or a macro at the end', () => {
    expect(isValidDomainSpec('example.com')).toBe(true);
    expect(isValidDomainSpec('example.%{d}')).toBe(true);
    expect(isValidDomainSpec('example.1')).toBe(false);
    expect(isValidDomainSpec('')).toBe(false);
  });
});
