import { describe, expect, it } from '@jest/globals';
import { serviceWorkerAllowedFindings } from '../../../src/lib/headersx/service-worker.js';

describe('serviceWorkerAllowedFindings', () => {
  it('is silent when absent', () => {
    expect(serviceWorkerAllowedFindings(null)).toEqual([]);
  });

  it('accepts a path scope', () => {
    expect(serviceWorkerAllowedFindings('/')).toEqual([]);
    expect(serviceWorkerAllowedFindings('/app/')).toEqual([]);
  });

  it('accepts an absolute URL scope', () => {
    expect(serviceWorkerAllowedFindings('https://x.test/app/')).toEqual([]);
  });

  it('warns on an empty value', () => {
    const [f] = serviceWorkerAllowedFindings('   ');
    expect(f?.severity).toBe('warning');
  });

  it('warns on a relative scope without a leading slash', () => {
    const [f] = serviceWorkerAllowedFindings('app/');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain("starting with '/'");
  });
});
