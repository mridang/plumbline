import { describe, expect, it } from '@jest/globals';

import { Coverage, type CoverageArea } from '@/components/landing/coverage';
import { html } from '../render';

const AREA: CoverageArea = {
  id: 'tls',
  title: 'HTTPS and certificates',
  description: 'Visitors reach the real site.',
  fixer: 'web server or CDN TLS config',
  checks: 20,
};

describe('Coverage', () => {
  it('shows each area with its count, what it covers and who fixes it', () => {
    const out = html(<Coverage areas={[AREA]} />);
    expect(out).toContain('HTTPS and certificates');
    expect(out).toContain('20 checks');
    expect(out).toContain('Visitors reach the real site.');
    expect(out).toContain('web server or CDN TLS config');
  });

  it('says “check” for an area with one', () => {
    expect(html(<Coverage areas={[{ ...AREA, checks: 1 }]} />)).toContain(
      '1 check<',
    );
  });

  it('leaves out an area with no checks', () => {
    expect(html(<Coverage areas={[{ ...AREA, checks: 0 }]} />)).not.toContain(
      'HTTPS and certificates',
    );
  });

  it('is the section the header’s “Checks” link points to', () => {
    expect(html(<Coverage areas={[]} />)).toContain('id="checks"');
  });
});
