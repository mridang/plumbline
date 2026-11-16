import { describe, expect, it } from '@jest/globals'; // eslint-disable-line unicorn/prevent-abbreviations -- file name mirrors the permanent hint id of the code it covers
import { relationshipMeFindings } from '../../../src/lib/discovery/rel-me.js';
import type { RelationshipLink } from '../../../src/lib/discovery/links.js';

const link = (rels: string[], href: string): RelationshipLink => ({
  rels,
  href,
  source: 'dom',
});

describe('relationshipMeFindings', () => {
  it('is silent when there are no rel=me links', () => {
    expect(
      relationshipMeFindings([link(['author'], 'https://x.test')]),
    ).toEqual([]);
  });

  it('reports the identity links found', () => {
    const [f] = relationshipMeFindings([link(['me'], 'https://github.com/x')]);
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('rel=me');
  });

  it('warns when a rel=me link has no target', () => {
    const [f] = relationshipMeFindings([link(['me'], '')]);
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('no href');
  });
});
