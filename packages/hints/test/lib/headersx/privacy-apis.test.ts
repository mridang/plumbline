import { describe, expect, it } from '@jest/globals';
import {
  attributionReportingFindings,
  observeBrowsingTopicsFindings,
} from '../../../src/lib/headersx/privacy-apis.js';

describe('attributionReportingFindings', () => {
  it('is silent when both headers are absent', () => {
    expect(attributionReportingFindings(null, null)).toEqual([]);
  });

  it('reports participation for a valid source registration', () => {
    const [f] = attributionReportingFindings('{"source_event_id":"1"}', null);
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('Attribution Reporting API');
  });

  it('reports participation for both headers', () => {
    expect(attributionReportingFindings('{"a":1}', '{"b":2}')).toHaveLength(2);
  });

  it('warns on invalid JSON', () => {
    const [f] = attributionReportingFindings('not json', null);
    expect(f?.severity).toBe('warning');
  });

  it('warns when the value is a JSON array, not an object', () => {
    const [f] = attributionReportingFindings('[1,2]', null);
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('JSON object');
  });
});

describe('observeBrowsingTopicsFindings', () => {
  it('is silent when absent', () => {
    expect(observeBrowsingTopicsFindings(null)).toEqual([]);
  });

  it('reports participation for ?1', () => {
    const [f] = observeBrowsingTopicsFindings('?1');
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('Topics API');
  });

  it('warns on any other value', () => {
    const [f] = observeBrowsingTopicsFindings('?0');
    expect(f?.severity).toBe('warning');
  });
});
