import { describe, expect, it } from '@jest/globals';
import type { TxtLookup } from '../../../src/lib/email/txt.js';
import {
  checkMtaSts,
  MAX_AGE_LIMIT,
  policyHost,
  policyUrl,
  type PolicyFetch,
} from '../../../src/lib/emailpolicy/mta-sts.js';

const ok = (records: string[]): TxtLookup => ({ status: 'ok', records });
const policyOk = (body: string, mediaType = 'text/plain'): PolicyFetch => ({
  status: 'ok',
  mediaType,
  body,
});
const missing: PolicyFetch = { status: 'missing' };

const goodPolicy = [
  'version: STSv1',
  'mode: enforce',
  'mx: mx.example.test',
  'max_age: 604800',
].join('\r\n');

describe('policyHost / policyUrl', () => {
  it('builds the host and URL from the domain', () => {
    expect(policyHost('example.test')).toBe('mta-sts.example.test');
    expect(policyUrl('example.test')).toBe(
      'https://mta-sts.example.test/.well-known/mta-sts.txt',
    );
  });
});

describe('checkMtaSts', () => {
  it('passes a correct TXT record and policy', () => {
    expect(
      checkMtaSts(
        'example.test',
        ok(['v=STSv1; id=20240101000000']),
        policyOk(goodPolicy),
      ),
    ).toEqual([]);
  });

  it('is silent when the TXT lookup failed', () => {
    expect(checkMtaSts('example.test', { status: 'error' }, missing)).toEqual(
      [],
    );
  });

  it('advises once when nothing is published', () => {
    const findings = checkMtaSts('example.test', ok([]), missing);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].message).toContain('does *not* enable MTA-STS');
  });

  it('advises once when the TXT lookup is NXDOMAIN and no policy', () => {
    const findings = checkMtaSts(
      'example.test',
      { status: 'nxdomain' },
      missing,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
  });

  it('errors when a policy file exists but the TXT record is absent', () => {
    const findings = checkMtaSts('example.test', ok([]), policyOk(goodPolicy));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].message).toContain('*no* `_mta-sts` TXT record');
  });

  it('errors on more than one TXT record', () => {
    const records = ['v=STSv1; id=a', 'v=STSv1; id=b'];
    const findings = checkMtaSts(
      'example.test',
      ok(records),
      policyOk(goodPolicy),
    );
    expect(findings[0].message).toContain('*more than one*');
    expect(findings[0].codeSnippet).toBe(records.join('\n'));
  });

  it('errors when the TXT record has the wrong version', () => {
    const findings = checkMtaSts(
      'example.test',
      ok(['v=STSv2; id=20240101000000']),
      policyOk(goodPolicy),
    );
    expect(findings[0].message).toContain('must start with `v=STSv1`');
  });

  it('errors on an id that is missing or too long', () => {
    expect(
      checkMtaSts('example.test', ok(['v=STSv1;']), policyOk(goodPolicy))[0]
        .message,
    ).toContain('1 to 32 letters or digits');
    const long = 'a'.repeat(33);
    expect(
      checkMtaSts(
        'example.test',
        ok([`v=STSv1; id=${long}`]),
        policyOk(goodPolicy),
      )[0].message,
    ).toContain('1 to 32 letters or digits');
  });

  it('errors when the TXT record exists but the policy file is missing', () => {
    const findings = checkMtaSts(
      'example.test',
      ok(['v=STSv1; id=a1']),
      missing,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].message).toContain(
      'policy file at the `mta-sts` host is *missing*',
    );
  });

  it('errors when the policy is not served as text/plain', () => {
    const findings = checkMtaSts(
      'example.test',
      ok(['v=STSv1; id=a1']),
      policyOk(goodPolicy, 'text/html'),
    );
    expect(findings.map((f) => f.message).join(' ')).toContain(
      '*not* served as `text/plain`',
    );
  });

  it('accepts a text/plain content type with a charset parameter', () => {
    expect(
      checkMtaSts(
        'example.test',
        ok(['v=STSv1; id=a1']),
        policyOk(goodPolicy, 'text/plain; charset=utf-8'),
      ),
    ).toEqual([]);
  });

  it('errors on a wrong policy version', () => {
    const body = goodPolicy.replace('version: STSv1', 'version: STSv2');
    const findings = checkMtaSts(
      'example.test',
      ok(['v=STSv1; id=a1']),
      policyOk(body),
    );
    expect(findings.map((f) => f.message).join(' ')).toContain(
      '`version` field must be `STSv1`',
    );
  });

  it('errors on an invalid mode', () => {
    const body = goodPolicy.replace('mode: enforce', 'mode: on');
    const findings = checkMtaSts(
      'example.test',
      ok(['v=STSv1; id=a1']),
      policyOk(body),
    );
    expect(findings.map((f) => f.message).join(' ')).toContain(
      '`mode` must be `enforce`, `testing` or `none`',
    );
  });

  it('warns when the policy is in testing mode', () => {
    const body = goodPolicy.replace('mode: enforce', 'mode: testing');
    const findings = checkMtaSts(
      'example.test',
      ok(['v=STSv1; id=a1']),
      policyOk(body),
    );
    const testing = findings.find((f) => f.message.includes('`testing` mode'));
    expect(testing?.severity).toBe('warning');
  });

  it('accepts a none policy with no mx', () => {
    const body = ['version: STSv1', 'mode: none', 'max_age: 604800'].join(
      '\r\n',
    );
    expect(
      checkMtaSts('example.test', ok(['v=STSv1; id=a1']), policyOk(body)),
    ).toEqual([]);
  });

  it('errors when an enforcing policy lists no mx', () => {
    const body = ['version: STSv1', 'mode: enforce', 'max_age: 604800'].join(
      '\r\n',
    );
    const findings = checkMtaSts(
      'example.test',
      ok(['v=STSv1; id=a1']),
      policyOk(body),
    );
    expect(findings.map((f) => f.message).join(' ')).toContain(
      'no `mx` host patterns',
    );
  });

  it('errors when max_age is missing, non-numeric, zero or too large', () => {
    const without = [
      'version: STSv1',
      'mode: enforce',
      'mx: mx.example.test',
    ].join('\r\n');
    expect(
      checkMtaSts('example.test', ok(['v=STSv1; id=a1']), policyOk(without))
        .map((f) => f.message)
        .join(' '),
    ).toContain('`max_age`');
    const tooBig = goodPolicy.replace(
      'max_age: 604800',
      `max_age: ${MAX_AGE_LIMIT + 1}`,
    );
    expect(
      checkMtaSts('example.test', ok(['v=STSv1; id=a1']), policyOk(tooBig))
        .map((f) => f.message)
        .join(' '),
    ).toContain('`max_age`');
    const zero = goodPolicy.replace('max_age: 604800', 'max_age: 0');
    expect(
      checkMtaSts('example.test', ok(['v=STSv1; id=a1']), policyOk(zero))
        .map((f) => f.message)
        .join(' '),
    ).toContain('`max_age`');
  });

  it('accepts a policy with multiple mx patterns', () => {
    const body = [
      'version: STSv1',
      'mode: enforce',
      'mx: mx1.example.test',
      'mx: mx2.example.test',
      'max_age: 86400',
    ].join('\r\n');
    expect(
      checkMtaSts('example.test', ok(['v=STSv1; id=a1']), policyOk(body)),
    ).toEqual([]);
  });
});
