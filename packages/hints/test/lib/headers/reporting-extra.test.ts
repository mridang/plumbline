import { describe, expect, it } from '@jest/globals';
import {
  integrityPolicyFindings,
  nelFindings,
  originAgentClusterFindings,
  reportingEndpointsFindings,
} from '../../../src/lib/headers/reporting-extra.js';
import { HTTP_SCHEME } from '../../helpers/data.js';

describe('reportingEndpointsFindings', () => {
  it('is silent when absent', () => {
    expect(reportingEndpointsFindings(null)).toEqual([]);
  });

  it('accepts a valid name to https-url map', () => {
    expect(
      reportingEndpointsFindings(
        'csp="https://e.test/r", main="https://e.test/m"',
      ),
    ).toEqual([]);
  });

  it('rejects a non-https or unquoted url', () => {
    expect(
      reportingEndpointsFindings(`csp="${HTTP_SCHEME}e.test/r"`)[0]?.severity,
    ).toBe('warning');
    expect(reportingEndpointsFindings('csp=https://e.test')[0]?.severity).toBe(
      'warning',
    );
  });
});

describe('nelFindings', () => {
  it('is silent when absent', () => {
    expect(nelFindings(null)).toEqual([]);
  });

  it('accepts a valid policy', () => {
    expect(nelFindings('{"report_to":"default","max_age":2592000}')).toEqual(
      [],
    );
  });

  it('accepts max_age 0 without a group', () => {
    expect(nelFindings('{"max_age":0}')).toEqual([]);
  });

  it('rejects invalid JSON', () => {
    expect(nelFindings('not json')[0]?.message).toContain('JSON');
  });

  it('requires max_age', () => {
    expect(nelFindings('{"report_to":"default"}')[0]?.message).toContain(
      'max_age',
    );
  });

  it('requires report_to while active', () => {
    expect(nelFindings('{"max_age":100}')[0]?.message).toContain('report_to');
  });
});

describe('originAgentClusterFindings', () => {
  it('recommends the header when absent', () => {
    expect(originAgentClusterFindings(null)[0]?.severity).toBe('hint');
  });

  it('accepts ?1', () => {
    expect(originAgentClusterFindings('?1')).toEqual([]);
  });

  it('warns on another value', () => {
    expect(originAgentClusterFindings('?0')[0]?.severity).toBe('warning');
  });
});

describe('integrityPolicyFindings', () => {
  it('is silent when absent', () => {
    expect(integrityPolicyFindings('Integrity-Policy', null)).toEqual([]);
  });

  it('accepts a blocked-destinations list', () => {
    expect(
      integrityPolicyFindings(
        'Integrity-Policy',
        'blocked-destinations=(script), sources=(inline)',
      ),
    ).toEqual([]);
  });

  it('warns without blocked-destinations', () => {
    expect(
      integrityPolicyFindings('Integrity-Policy', 'sources=(inline)')[0]
        ?.message,
    ).toContain('blocked-destinations');
  });

  it('warns on an empty blocked-destinations list', () => {
    expect(
      integrityPolicyFindings('Integrity-Policy', 'blocked-destinations=()')[0]
        ?.severity,
    ).toBe('warning');
  });
});
