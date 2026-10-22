import { describe, expect, it } from '@jest/globals';
import { hostMetaFindings } from '../../../src/lib/discovery/host-meta.js';

describe('hostMetaFindings', () => {
  it('is silent when absent or 404', () => {
    expect(hostMetaFindings(null)).toEqual([]);
    expect(
      hostMetaFindings({ statusCode: 404, mediaType: '', body: '' }),
    ).toEqual([]);
  });

  it('reports a valid XRD document', () => {
    const [f] = hostMetaFindings({
      statusCode: 200,
      mediaType: 'application/xrd+xml',
      body: '<?xml version="1.0"?><XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0"></XRD>',
    });
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('XRD');
  });

  it('reports a valid JRD document', () => {
    const [f] = hostMetaFindings({
      statusCode: 200,
      mediaType: 'application/json',
      body: '{"links":[]}',
    });
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('JRD');
  });

  it('warns on invalid JRD JSON', () => {
    const [f] = hostMetaFindings({
      statusCode: 200,
      mediaType: 'application/json',
      body: 'nope',
    });
    expect(f?.severity).toBe('warning');
  });

  it('warns when the body is neither XRD nor JSON', () => {
    const [f] = hostMetaFindings({
      statusCode: 200,
      mediaType: 'text/plain',
      body: 'hello',
    });
    expect(f?.severity).toBe('warning');
  });
});
