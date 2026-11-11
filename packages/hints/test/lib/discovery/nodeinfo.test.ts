import { describe, expect, it } from '@jest/globals';
import { nodeinfoFindings } from '../../../src/lib/discovery/nodeinfo.js';

describe('nodeinfoFindings', () => {
  it('is silent when absent or 404', () => {
    expect(nodeinfoFindings(null)).toEqual([]);
    expect(nodeinfoFindings({ statusCode: 404, body: '' })).toEqual([]);
  });

  it('reports a valid links document', () => {
    const [f] = nodeinfoFindings({
      statusCode: 200,
      // eslint-disable-next-line unicorn/prefer-https -- test fixture
      body: '{"links":[{"rel":"http://nodeinfo.diaspora.software/ns/schema/2.1","href":"https://x.test/ni"}]}',
    });
    expect(f?.severity).toBe('hint');
  });

  it('warns on invalid JSON', () => {
    const [f] = nodeinfoFindings({ statusCode: 200, body: 'nope' });
    expect(f?.severity).toBe('warning');
  });

  it('warns when links is missing or empty', () => {
    expect(
      nodeinfoFindings({ statusCode: 200, body: '{"links":[]}' })[0]?.severity,
    ).toBe('warning');
    expect(nodeinfoFindings({ statusCode: 200, body: '{}' })[0]?.severity).toBe(
      'warning',
    );
  });

  it('warns when a link lacks rel or href', () => {
    const [f] = nodeinfoFindings({
      statusCode: 200,
      body: '{"links":[{"rel":"x"}]}',
    });
    expect(f?.severity).toBe('warning');
  });
});
