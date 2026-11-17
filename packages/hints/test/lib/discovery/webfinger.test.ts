import { describe, expect, it } from '@jest/globals';
import { webfingerFindings } from '../../../src/lib/discovery/webfinger.js';

describe('webfingerFindings', () => {
  it('is silent when absent or 404', () => {
    expect(webfingerFindings(null)).toEqual([]);
    expect(
      webfingerFindings({ statusCode: 404, mediaType: '', body: '' }),
    ).toEqual([]);
  });

  it('reports a conformant 400 (resource required)', () => {
    const f = webfingerFindings({
      statusCode: 400,
      mediaType: '',
      body: '',
    }).at(0);
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('WebFinger');
  });

  it('reports a valid JRD on 200', () => {
    const f = webfingerFindings({
      statusCode: 200,
      mediaType: 'application/jrd+json',
      body: '{"subject":"acct:a@x.test","links":[]}',
    }).at(0);
    expect(f?.severity).toBe('hint');
  });

  it('warns on a wrong content type', () => {
    const f = webfingerFindings({
      statusCode: 200,
      mediaType: 'text/html',
      body: '{}',
    }).at(0);
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('jrd+json');
  });

  it('warns on invalid JSON', () => {
    const f = webfingerFindings({
      statusCode: 200,
      mediaType: 'application/jrd+json',
      body: 'nope',
    }).at(0);
    expect(f?.severity).toBe('warning');
  });

  it('warns when the JRD lacks subject and links', () => {
    const f = webfingerFindings({
      statusCode: 200,
      mediaType: 'application/jrd+json',
      body: '{"foo":1}',
    }).at(0);
    expect(f?.severity).toBe('warning');
  });
});
