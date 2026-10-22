import { describe, expect, it } from '@jest/globals';
import { webmentionFindings } from '../../../src/lib/discovery/webmention.js';
import type { RelLink } from '../../../src/lib/discovery/links.js';

const link = (href: string): RelLink => ({
  rels: ['webmention'],
  href,
  source: 'dom',
});

describe('webmentionFindings', () => {
  it('is silent when there is no webmention link', () => {
    expect(
      webmentionFindings([{ rels: ['me'], href: 'x', source: 'dom' }]),
    ).toEqual([]);
  });

  it('reports a present absolute endpoint', () => {
    const [f] = webmentionFindings([link('https://x.test/wm')]);
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('Webmention');
  });

  it('warns when the endpoint is relative', () => {
    const [f] = webmentionFindings([link('/wm')]);
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('absolute');
  });

  it('warns when the endpoint has no target', () => {
    const [f] = webmentionFindings([link('')]);
    expect(f?.severity).toBe('warning');
  });
});
