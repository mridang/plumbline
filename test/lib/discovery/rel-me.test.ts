import { describe, expect, it } from '@jest/globals';
import { relMeFindings } from '../../../src/lib/discovery/rel-me.js';
import type { RelLink } from '../../../src/lib/discovery/links.js';

const link = (rels: string[], href: string): RelLink => ({
  rels,
  href,
  source: 'dom',
});

describe('relMeFindings', () => {
  it('is silent when there are no rel=me links', () => {
    expect(relMeFindings([link(['author'], 'https://x.test')])).toEqual([]);
  });

  it('reports the identity links found', () => {
    const [f] = relMeFindings([link(['me'], 'https://github.com/x')]);
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('rel=me');
  });

  it('warns when a rel=me link has no target', () => {
    const [f] = relMeFindings([link(['me'], '')]);
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('no href');
  });
});
