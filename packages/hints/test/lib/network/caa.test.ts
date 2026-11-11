import { afterEach, describe, expect, it } from '@jest/globals';
import {
  evaluateCaa,
  formatCaa,
  MISSING_ISSUE,
  parseCaa,
  retrieveCaa,
  validateCaaRecord,
  type CaaRecord,
} from '../../../src/lib/network/caa.js';
import { installDns } from './fake-dns.js';
import { FTP_SCHEME, HTTP_SCHEME } from '../../helpers/data.js';

let restore: () => void = () => undefined;
afterEach(() => restore());

const rec = (tag: string, value: string, flags = 0): CaaRecord => ({
  flags,
  tag,
  value,
});

describe('parseCaa', () => {
  it('parses presentation format', () => {
    expect(parseCaa('0 issue "letsencrypt.org"')).toEqual(
      rec('issue', 'letsencrypt.org'),
    );
    expect(parseCaa('128 iodef "mailto:a@example.org"')).toEqual(
      rec('iodef', 'mailto:a@example.org', 128),
    );
  });
  it('parses the generic format', () => {
    // flags 0, tag "issue", value "ca.test"
    const hex = '00056973737565' + Buffer.from('ca.test').toString('hex');
    expect(parseCaa(String.raw`\# 14 ${hex}`)).toEqual(rec('issue', 'ca.test'));
  });
  it('rejects garbage and truncated generic data', () => {
    expect(parseCaa('???')).toBeNull();
    expect(parseCaa(String.raw`\# 3 000a`)).toBeNull();
  });
});

describe('validateCaaRecord', () => {
  it.each([
    ['issue', 'letsencrypt.org'],
    ['issue', ';'],
    ['issue', ''],
    ['issuewild', 'ca.test; accounturi=https://ca.test/acct/1'],
    ['issue', 'ca.test; validationmethods=dns-01,ca-custom'],
    ['issuevmc', 'ca.test'],
    ['issuemail', 'ca.test'],
    ['iodef', 'mailto:security@example.org'],
    ['iodef', 'https://example.org/report'],
    ['contactemail', 'a@example.org'],
    ['contactphone', '+31201234567'],
  ])('accepts %s %s', (tag, value) => {
    expect(validateCaaRecord(rec(tag, value))).toBeNull();
  });

  it.each([
    ['issue', 'bad domain', 'invalid-property-syntax'],
    ['issue', 'ca.test; =x', 'invalid-property-syntax'],
    ['issue', 'ca.test; a=b;;c=d', 'invalid-property-syntax'],
    [
      'issue',
      'ca.test; validationmethods=smoke-signal',
      'invalid-parameter-validation-methods',
    ],
    ['issuemail', 'bad domain', 'invalid-property-issuemail-value'],
    ['iodef', `${HTTP_SCHEME}example.org/`, 'invalid-property-iodef-value'],
    ['iodef', 'mailto:nonsense', 'invalid-property-iodef-value'],
    ['iodef', 'not a url', 'invalid-property-iodef-value'],
    ['contactemail', 'nope', 'invalid-property-contactemail-value'],
    ['contactphone', '0612345678', 'invalid-property-contactphone-value'],
    ['auth', 'x', 'invalid-reserved-property'],
    ['made-up', 'x', 'invalid-unknown-property'],
  ])('rejects %s %s', (tag, value, id) => {
    expect(validateCaaRecord(rec(tag, value))).toBe(id);
  });

  it('rejects reserved flag bits', () => {
    expect(validateCaaRecord(rec('issue', 'ca.test', 1))).toBe(
      'invalid-flags-reserved-bits',
    );
    expect(validateCaaRecord(rec('issue', 'ca.test', 128))).toBeNull();
  });
});

describe('evaluateCaa', () => {
  it('is clean for a valid set with an issue property', () => {
    const e = evaluateCaa([rec('issue', 'ca.test')], 'example.test');
    expect(e).toMatchObject({
      found: true,
      foundOn: 'example.test',
      errors: [],
    });
  });
  it('requires an issue property', () => {
    const e = evaluateCaa([rec('iodef', 'mailto:a@example.org')], 'x');
    expect(e.errors.map((x) => x.id)).toEqual([MISSING_ISSUE]);
    expect(e.errors[0].message).toBe(
      "Error: Required 'issue' property missing",
    );
  });
  it('reports syntax errors with readable messages', () => {
    const e = evaluateCaa(
      [rec('issue', 'ca.test'), rec('iodef', `${FTP_SCHEME}x`)],
      'x',
    );
    expect(e.errors).toHaveLength(1);
    expect(e.errors[0].message).toContain('Invalid iodef value');
  });
  it('evaluates at most 100 records', () => {
    const many = Array.from({ length: 150 }, () => rec('issue', 'ca.test'));
    expect(evaluateCaa(many, 'x').records).toHaveLength(100);
  });
});

describe('retrieveCaa', () => {
  it('climbs the tree to the parent that has records', async () => {
    restore = installDns({
      'example.test': { CAA: { data: ['0 issue "ca.test"'] } },
    });
    const r = await retrieveCaa('www.shop.example.test');
    expect(r.found).toBe(true);
    expect(r.foundOn).toBe('example.test');
  });
  it('finds nothing when no level has CAA', async () => {
    restore = installDns({});
    expect(await retrieveCaa('www.example.test')).toEqual({
      found: false,
      foundOn: null,
      records: [],
      errors: [],
    });
  });
});

describe('formatCaa', () => {
  it('renders a zone file line', () => {
    expect(formatCaa(rec('issue', 'ca.test', 128), 'example.test')).toBe(
      'example.test. IN CAA 128 issue "ca.test"',
    );
  });
});
