import { describe, expect, it } from '@jest/globals';
import { validateAdsTxt } from '../../../src/lib/wellknown/ads-txt.js';

const msgs = (t: string) => validateAdsTxt(t).map((i) => i.message);

describe('validateAdsTxt', () => {
  it('accepts a valid record with a certification authority id', () => {
    expect(
      validateAdsTxt('example.com, 12345, DIRECT, f08c47fec0942fa0\n'),
    ).toEqual([]);
  });

  it('accepts a three-field record without a cert authority id', () => {
    expect(validateAdsTxt('example.com, 12345, RESELLER')).toEqual([]);
  });

  it('accepts all defined variables', () => {
    const text =
      'CONTACT=ads@example.com\nSUBDOMAIN=sub.example.com\nOWNERDOMAIN=example.com\nMANAGERDOMAIN=mgr.example.com\nINVENTORYPARTNERDOMAIN=p.example.com\nexample.com, 1, DIRECT';
    expect(validateAdsTxt(text)).toEqual([]);
  });

  it('ignores blank lines and comments', () => {
    expect(
      validateAdsTxt('# a comment\n\nexample.com, 1, DIRECT # inline'),
    ).toEqual([]);
  });

  it('flags a record with too few fields', () => {
    const issues = validateAdsTxt('example.com, 12345');
    expect(issues[0].message).toContain('Malformed record');
    expect(issues[0].line).toBe(1);
  });

  it('flags an invalid relationship', () => {
    expect(msgs('example.com, 1, PARTNER')).toContain(
      "The account relationship (third field) must be DIRECT or RESELLER, not 'PARTNER'.",
    );
  });

  it('accepts a lower-case relationship', () => {
    expect(validateAdsTxt('example.com, 1, direct')).toEqual([]);
  });

  it('flags an empty domain field', () => {
    expect(msgs(', 1, DIRECT')).toContain(
      'The advertising system domain (first field) is empty.',
    );
  });

  it('flags an empty publisher id field', () => {
    expect(msgs('example.com, , DIRECT')).toContain(
      'The publisher account id (second field) is empty.',
    );
  });

  it('warns on an unknown variable', () => {
    const issues = validateAdsTxt('FOO=bar\nexample.com, 1, DIRECT');
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain("Unknown variable 'FOO'");
  });

  it('flags a variable with no value', () => {
    expect(msgs('CONTACT=\nexample.com, 1, DIRECT')).toContain(
      "The 'CONTACT' variable has no value.",
    );
  });

  it('warns when there are no records', () => {
    expect(msgs('# only a comment')).toContain(
      'The file contains no advertising-system records.',
    );
  });
});
