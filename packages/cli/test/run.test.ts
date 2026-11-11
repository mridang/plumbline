import { describe, expect, it } from '@jest/globals';

import { resolveDependencies } from '../src/run.js';
import { hintCatalogue, scan } from '../src/scan.js';

describe('resolveDependencies', () => {
  it('uses the real scan and catalogue when nothing is replaced', async () => {
    const deps = await resolveDependencies();
    expect(deps.scan).toBe(scan);
    expect(deps.catalogue).toBe(hintCatalogue);
    expect(typeof deps.version).toBe('string');
  });

  it('keeps what the caller replaces', async () => {
    const catalogue = () => [];
    const deps = await resolveDependencies({ catalogue, version: '1.2.3' });
    expect(deps.catalogue).toBe(catalogue);
    expect(deps.version).toBe('1.2.3');
  });
});
