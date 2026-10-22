import { describe, expect, it } from '@jest/globals';
import {
  serverBannerFindings,
  serverTimingFindings,
  sourcemapFindings,
  viaFindings,
  xPoweredByFindings,
} from '../../../src/lib/headers/info-leak.js';

describe('serverBannerFindings', () => {
  it('is silent when absent or a bare product name', () => {
    expect(serverBannerFindings(null)).toEqual([]);
    expect(serverBannerFindings('nginx')).toEqual([]);
  });

  it('warns when a version or platform is disclosed', () => {
    expect(serverBannerFindings('nginx/1.25.3')[0]?.severity).toBe('warning');
    expect(serverBannerFindings('Apache/2.4 (Ubuntu)')[0]?.message).toContain(
      'version',
    );
  });
});

describe('xPoweredByFindings', () => {
  it('is silent when absent', () => {
    expect(xPoweredByFindings(null)).toEqual([]);
  });

  it('warns on any value', () => {
    const [f] = xPoweredByFindings('Express');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('Express');
  });
});

describe('serverTimingFindings', () => {
  it('is silent when absent', () => {
    expect(serverTimingFindings(null)).toEqual([]);
  });

  it('notes the header when present', () => {
    expect(serverTimingFindings('db;dur=53')[0]?.severity).toBe('hint');
  });
});

describe('viaFindings', () => {
  it('is silent when absent', () => {
    expect(viaFindings(null)).toEqual([]);
  });

  it('reports a hop that names software', () => {
    expect(viaFindings('1.1 varnish')[0]?.severity).toBe('hint');
    expect(viaFindings('1.1 cloudfront')[0]?.message).toContain('Via');
  });
});

describe('sourcemapFindings', () => {
  it('is silent when neither header is present', () => {
    expect(sourcemapFindings(null, null)).toEqual([]);
  });

  it('reports a SourceMap header', () => {
    const [f] = sourcemapFindings('/app.js.map', null);
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('SourceMap');
  });

  it('reports the legacy X-SourceMap header', () => {
    expect(sourcemapFindings(null, '/app.js.map')[0]?.message).toContain(
      'X-SourceMap',
    );
  });
});
