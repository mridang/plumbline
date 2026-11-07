import { describe, expect, it } from '@jest/globals';
import {
  externalReports,
  reportingFindings,
} from '../../../src/lib/headers/reporting.js';

const base = {
  registrable: 'example.com',
  csp: null,
  cspReportOnly: null,
  nel: null,
  reportTo: null,
};

const group = (name: string, url: string) =>
  JSON.stringify({ group: name, max_age: 10, endpoints: [{ url }] });

describe('externalReports', () => {
  it('finds nothing without headers', () => {
    expect(externalReports(base)).toEqual({});
  });

  it('flags a third-party report-uri in both CSP headers', () => {
    const result = externalReports({
      ...base,
      csp: "default-src 'self'; report-uri https://r.example.net/a /local",
      cspReportOnly: "default-src 'self'; report-uri https://r.other.org/b",
    });
    expect(result.cspReportUri).toEqual(['https://r.example.net/a']);
    expect(result.cspReportOnlyReportUri).toEqual(['https://r.other.org/b']);
  });

  it('ignores first-party and relative endpoints', () => {
    expect(
      externalReports({
        ...base,
        csp: "default-src 'self'; report-uri https://csp.example.com/r /x",
      }),
    ).toEqual({});
  });

  it('follows report-to groups of both CSP headers', () => {
    const result = externalReports({
      ...base,
      csp: "default-src 'self'; report-to grp",
      cspReportOnly: "default-src 'self'; report-to grp2",
      reportTo: `${group('grp', 'https://r.example.net/a')}, ${group('grp2', 'https://r.other.org/b')}`,
    });
    expect(result.cspReportTo).toEqual(['https://r.example.net/a']);
    expect(result.cspReportOnlyReportTo).toEqual(['https://r.other.org/b']);
  });

  it('follows the NEL report_to group', () => {
    const result = externalReports({
      ...base,
      nel: '{"report_to":"nel","max_age":60}',
      reportTo: group('nel', 'https://nel.example.net/'),
    });
    expect(result.nel).toEqual(['https://nel.example.net/']);
  });

  it('ignores groups that are first-party, differently named or without endpoints', () => {
    expect(
      externalReports({
        ...base,
        csp: "default-src 'self'; report-to a",
        nel: '{"report_to":"b"}',
        reportTo: [
          group('a', 'https://x.example.com/'),
          group('b', 'not a url'),
          '{"group":"b"}',
        ].join(','),
      }),
    ).toEqual({});
  });

  it('survives malformed JSON', () => {
    expect(
      externalReports({
        ...base,
        csp: "default-src 'self'; report-to a",
        nel: '{',
        reportTo: '{',
      }),
    ).toEqual({});
    expect(
      externalReports({
        ...base,
        nel: 'not json',
        reportTo: group('a', 'https://x.example.net/'),
      }),
    ).toEqual({});
    expect(
      externalReports({
        ...base,
        nel: '{}',
        reportTo: group('a', 'https://x.example.net/'),
      }),
    ).toEqual({});
  });
});

describe('externalReports on a site served by Cloudflare', () => {
  const nel = '{"report_to":"cf-nel"}';
  const collector = group('cf-nel', 'https://a.nel.cloudflare.com/report/v4');

  it("ignores Cloudflare's injected NEL collector", () => {
    expect(
      externalReports({ ...base, nel, reportTo: collector, cloudflare: true }),
    ).toEqual({});
  });

  it('reports the same collector when the response did not come through Cloudflare', () => {
    expect(externalReports({ ...base, nel, reportTo: collector }).nel).toEqual([
      'https://a.nel.cloudflare.com/report/v4',
    ]);
    expect(
      externalReports({ ...base, nel, reportTo: collector, cloudflare: false })
        .nel,
    ).toEqual(['https://a.nel.cloudflare.com/report/v4']);
  });

  it("ignores the collector in a CSP 'report-uri' and in both CSP 'report-to' groups", () => {
    expect(
      externalReports({
        ...base,
        csp: "default-src 'self'; report-uri https://a.nel.cloudflare.com/r; report-to cf-nel",
        cspReportOnly: "default-src 'self'; report-to cf-nel",
        reportTo: collector,
        cloudflare: true,
      }),
    ).toEqual({});
  });

  it.each([
    'https://nel.cloudflare.com.example.net/r',
    'https://evilnel.cloudflare.com/r',
    'https://cloudflare.com/r',
    'https://r.example.net/r',
  ])('still reports %s', (url) => {
    expect(
      externalReports({
        ...base,
        nel,
        reportTo: group('cf-nel', url),
        cloudflare: true,
      }).nel,
    ).toEqual([url]);
  });
});

describe('reportingFindings', () => {
  it('has one error per offending place', () => {
    const findings = reportingFindings({
      ...base,
      csp: "default-src 'self'; report-uri https://r.example.net/a",
      nel: '{"report_to":"n"}',
      reportTo: group('n', 'https://n.example.net/'),
    });
    expect(findings).toHaveLength(2);
    expect(findings[0]?.message).toContain(
      "'report-uri' of the Content-Security-Policy header",
    );
    expect(findings[1]?.message).toContain('NEL');
    expect(findings.every((f) => f.severity === 'error')).toBe(true);
  });

  it('is empty when everything is first party', () => {
    expect(reportingFindings(base)).toEqual([]);
  });
});
