import { describe, expect, it } from '@jest/globals';
import { pingbackFindings } from '../../../src/lib/discovery/pingback.js';
import type { RelLink } from '../../../src/lib/discovery/links.js';

describe('pingbackFindings', () => {
  it('is silent when no pingback is advertised', () => {
    expect(pingbackFindings([], null)).toEqual([]);
  });

  it('warns when a rel=pingback link is present', () => {
    const links: RelLink[] = [
      { rels: ['pingback'], href: 'https://x.test/xmlrpc', source: 'dom' },
    ];
    const [f] = pingbackFindings(links, null);
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('Webmention');
  });

  it('warns when an X-Pingback header is present', () => {
    const [f] = pingbackFindings([], 'https://x.test/xmlrpc');
    expect(f?.severity).toBe('warning');
  });
});
