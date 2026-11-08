import { describe, expect, it } from '@jest/globals';

import { scannerNamespace } from '@/lib/cloudflare/scanner-namespace';

const SCANNER = { name: 'scanner' };
const PROBE = { name: 'probe' };

describe('scannerNamespace', () => {
  it('runs the checks in the scanner container unless the worker engine is asked for', () => {
    expect(scannerNamespace({ SCANNER, PROBE })).toBe(SCANNER);
    expect(scannerNamespace({ SCANNER, PROBE, SCAN_ENGINE: 'container' })).toBe(
      SCANNER,
    );
    expect(
      scannerNamespace({ SCANNER, PROBE, SCAN_ENGINE: 'anything else' }),
    ).toBe(SCANNER);
  });

  it('runs them in the probe scanner object for the worker engine', () => {
    expect(scannerNamespace({ SCANNER, PROBE, SCAN_ENGINE: 'worker' })).toBe(
      PROBE,
    );
  });

  it('has nothing when the namespace the engine needs is not bound', () => {
    expect(scannerNamespace({ SCANNER })).toBe(SCANNER);
    expect(
      scannerNamespace({ SCANNER, SCAN_ENGINE: 'worker' }),
    ).toBeUndefined();
    expect(scannerNamespace({})).toBeUndefined();
  });
});
