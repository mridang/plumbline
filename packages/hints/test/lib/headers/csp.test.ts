import { describe, expect, it } from '@jest/globals';
import {
  analyzeCsp,
  analyzeCspFromHeaders,
  cspFindings,
  CspParseError,
  DUPLICATE_WARNINGS_KEY,
  owaspCspFindings,
  parseCsp,
  parseCspLoose,
  parseCspMeta,
} from '../../../src/lib/headers/csp.js';
import { HTTP_SCHEME } from '../../helpers/data.js';

const run = (
  policy: string,
  extra: Partial<Parameters<typeof analyzeCsp>[0]> = {},
) =>
  analyzeCsp({
    headers: [policy],
    metas: [],
    reportOnly: false,
    secure: true,
    ...extra,
  });

describe('parseCsp', () => {
  it('maps directives to sources, lower-cased', () => {
    const csp = parseCsp(["Default-Src 'SELF' https://A.example"]);
    expect(
      [...(csp.get('default-src') ?? [])].toSorted((a, b) =>
        a.localeCompare(b),
      ),
    ).toEqual(["'self'", 'https://a.example']);
  });

  it('treats an empty source list as none', () => {
    expect([
      ...(parseCsp(['script-src; img-src *']).get('script-src') ?? []),
    ]).toEqual(["'none'"]);
  });

  it('returns an empty map for no policies', () => {
    expect(parseCsp([]).size).toBe(0);
  });

  it('rejects empty or too short policies', () => {
    expect(() => parseCsp([''])).toThrow(CspParseError);
    expect(() => parseCsp(['a'])).toThrow('Invalid policy');
  });

  it('rejects repeated directives', () => {
    expect(() => parseCsp(["img-src 'self'; img-src *"])).toThrow(
      'Duplicate directive img-src',
    );
  });

  it('tolerates repeated report-uri and records it', () => {
    const csp = parseCsp(['report-uri /a; report-uri /b']);
    expect([...(csp.get(DUPLICATE_WARNINGS_KEY) ?? [])]).toEqual([
      'report-uri',
    ]);
  });

  it('drops a longer source that starts with a shorter one', () => {
    const csp = parseCsp([
      'img-src https://a.example/foo https://a.example/foobar',
    ]);
    expect([...(csp.get('img-src') ?? [])]).toEqual(['https://a.example/foo']);
  });

  it('keeps only sources present in every policy', () => {
    const csp = parseCsp([
      "script-src 'self' https://a.example",
      "script-src 'self' https://b.example",
    ]);
    expect([...(csp.get('script-src') ?? [])]).toEqual(["'self'"]);
  });

  it('falls back to none when two policies share nothing', () => {
    const csp = parseCsp([
      'script-src https://a.example',
      'script-src https://b.example',
    ]);
    expect([...(csp.get('script-src') ?? [])]).toEqual(["'none'"]);
  });

  it('matches paths across policies', () => {
    const csp = parseCsp([
      'img-src https://a.example/dir/',
      'img-src https://a.example/dir/x',
    ]);
    expect([...(csp.get('img-src') ?? [])]).toEqual([
      'https://a.example/dir/x',
    ]);
  });
});

describe('parseCspMeta', () => {
  it('drops directives meta tags cannot carry', () => {
    const csp = parseCspMeta([
      "default-src 'none'; frame-ancestors 'none'; sandbox; report-uri /r",
    ]);
    expect([...csp.keys()]).toEqual(['default-src']);
  });
});

describe('parseCspLoose', () => {
  it('keeps the first occurrence and never throws', () => {
    const csp = parseCspLoose('report-uri /a; report-uri /b; x;');
    expect(csp.get('report-uri')).toEqual(['/a']);
    expect(csp.has('x')).toBe(false);
  });

  it('defaults an empty list to none', () => {
    expect(
      parseCspLoose('script-src ;\nobject-src')?.get('object-src'),
    ).toEqual(["'none'"]);
  });

  it('handles a missing policy', () => {
    expect(parseCspLoose(null).size).toBe(0);
  });
});

describe('analyzeCsp results', () => {
  it('not implemented without any policy', () => {
    expect(
      analyzeCsp({ headers: [], metas: [], reportOnly: false, secure: true })
        .result,
    ).toBe('csp-not-implemented');
  });

  it('reporting only when just the report-only header exists', () => {
    expect(
      analyzeCsp({ headers: [], metas: [], reportOnly: true, secure: true })
        .result,
    ).toBe('csp-not-implemented-but-reporting-enabled');
  });

  it('a meta with only header-only directives counts as nothing', () => {
    expect(
      run('x', { headers: [], metas: ["frame-ancestors 'none'"] }).result,
    ).toBe('csp-not-implemented');
  });

  it('invalid for an unparsable policy', () => {
    expect(run('x').result).toBe('csp-header-invalid');
    expect(run("img-src 'self'; img-src *").result).toBe('csp-header-invalid');
  });

  it('default-src none is the best result', () => {
    const a = run("default-src 'none'; form-action 'none'");
    expect(a.result).toBe('csp-implemented-with-no-unsafe-default-src-none');
    expect(a.pass).toBe(true);
    expect(a.policy?.defaultNone).toBe(true);
  });

  it('no unsafe without default-src none', () => {
    const a = run("default-src 'self'");
    expect(a.result).toBe('csp-implemented-with-no-unsafe');
    expect(a.pass).toBe(true);
  });

  it.each([
    ["default-src 'self' 'unsafe-inline'", 'unsafeInline'],
    ["script-src 'self' data:; object-src 'none'", 'unsafeInline'],
    ["script-src 'self'; object-src *", 'unsafeInline'],
    ["style-src 'self'", 'unsafeInline'],
  ])('unsafe inline: %s', (policy) => {
    const a = run(policy);
    expect(a.result).toBe('csp-implemented-with-unsafe-inline');
    expect(a.pass).toBe(false);
    expect(a.policy?.unsafeInline).toBe(true);
  });

  it('unsafe-eval', () => {
    const a = run("default-src 'self' 'unsafe-eval'");
    expect(a.result).toBe('csp-implemented-with-unsafe-eval');
    expect(a.pass).toBe(false);
  });

  it('insecure scheme in active content only on https', () => {
    const policy = `default-src 'none'; script-src 'self'; connect-src ${HTTP_SCHEME}a.example`;
    expect(run(policy).result).toBe('csp-implemented-with-insecure-scheme');
    expect(run(policy, { secure: false }).result).toBe(
      'csp-implemented-with-no-unsafe-default-src-none',
    );
  });

  it('insecure scheme in passive content passes with advice', () => {
    const a = run(
      `default-src 'none'; script-src 'self'; img-src ${HTTP_SCHEME}a.example`,
    );
    expect(a.result).toBe(
      'csp-implemented-with-insecure-scheme-in-passive-content-only',
    );
    expect(a.pass).toBe(true);
  });

  it('unsafe-inline in style-src only passes with advice', () => {
    const a = run(
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    );
    expect(a.result).toBe(
      'csp-implemented-with-unsafe-inline-in-style-src-only',
    );
    expect(a.pass).toBe(true);
  });

  it('a nonce cancels unsafe-inline', () => {
    const a = run(
      "default-src 'none'; script-src 'nonce-abc' 'unsafe-inline'; style-src 'sha256-abc' 'unsafe-inline'",
    );
    expect(a.result).toBe('csp-implemented-with-no-unsafe-default-src-none');
  });

  it('strict-dynamic with a nonce ignores broad sources', () => {
    const a = run(
      "default-src 'none'; script-src 'nonce-abc' 'strict-dynamic' https: 'self'",
    );
    expect(a.policy?.strictDynamic).toBe(true);
    expect(a.pass).toBe(true);
  });

  it('strict-dynamic without nonce or hash is invalid', () => {
    expect(run("default-src 'none'; script-src 'strict-dynamic'").result).toBe(
      'csp-header-invalid',
    );
  });

  it('flags a duplicate report-uri on a passing policy', () => {
    const a = run("default-src 'none'; report-uri /a; report-uri /b");
    expect(a.result).toBe('csp-implemented-but-duplicate-directives');
    expect(a.pass).toBe(true);
  });

  it('merges header and meta policies', () => {
    const a = run("default-src 'none'", {
      metas: ["default-src 'none'; img-src 'self'"],
    });
    expect(a.pass).toBe(true);
  });

  it('splits comma separated policies', () => {
    const a = run("default-src 'none', default-src 'none'");
    expect(a.data?.['default-src']).toEqual(["'none'"]);
  });

  it('computes the supporting flags', () => {
    const a = run(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    expect(a.policy).toMatchObject({
      antiClickjacking: true,
      insecureBaseUri: false,
      insecureFormAction: false,
      unsafeObjects: false,
    });
    const b = run(
      "default-src 'none'; base-uri *; form-action *; object-src *",
    );
    expect(b.policy).toMatchObject({
      antiClickjacking: false,
      insecureBaseUri: true,
      insecureFormAction: true,
      unsafeObjects: true,
    });
  });

  it('reads frame-ancestors only from headers', () => {
    const a = run("default-src 'none'", {
      headers: [],
      metas: ["default-src 'none'; frame-ancestors 'none'"],
    });
    expect(a.policy?.antiClickjacking).toBe(false);
  });
});

describe('cspFindings', () => {
  it('errors on a failing result', () => {
    const f = cspFindings(run("default-src 'self' 'unsafe-eval'"));
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe('error');
    expect(f[0]?.message).toContain("'unsafe-eval'");
  });

  it('warns on passing results with advice', () => {
    const f = cspFindings(
      run("default-src 'none'; script-src 'self'; style-src 'unsafe-inline'"),
    );
    expect(f[0]?.severity).toBe('warning');
    expect(f[0]?.message).toContain('style-src');
  });

  it('is silent for a clean policy', () => {
    expect(cspFindings(run("default-src 'none'"))).toEqual([]);
    expect(cspFindings(run("default-src 'self'"))).toEqual([]);
  });

  it('describes each failing result', () => {
    expect(cspFindings(run('x'))[0]?.message).toContain('cannot be parsed');
    expect(
      cspFindings(
        analyzeCsp({ headers: [], metas: [], reportOnly: false, secure: true }),
      )[0]?.message,
    ).toContain('not implemented');
    expect(
      cspFindings(
        analyzeCsp({ headers: [], metas: [], reportOnly: true, secure: true }),
      )[0]?.message,
    ).toContain('Report-Only');
  });
});

describe('analyzeCspFromHeaders', () => {
  it('reads the CSP and report-only headers', () => {
    expect(
      analyzeCspFromHeaders(
        { 'content-security-policy': "default-src 'none'" },
        [],
        true,
      ).pass,
    ).toBe(true);
    expect(
      analyzeCspFromHeaders(
        { 'content-security-policy-report-only': "default-src 'none'" },
        [],
        true,
      ).result,
    ).toBe('csp-not-implemented-but-reporting-enabled');
  });
});

describe('owaspCspFindings', () => {
  it('requires the header', () => {
    expect(owaspCspFindings([])[0]?.message).toContain('not specified');
  });

  it("rejects any 'unsafe' substring", () => {
    expect(
      owaspCspFindings(["script-src 'unsafe-inline'"])[0]?.message,
    ).toContain('unsafe');
  });

  it('accepts a policy without unsafe', () => {
    expect(owaspCspFindings(["default-src 'none'"])).toEqual([]);
  });
});
