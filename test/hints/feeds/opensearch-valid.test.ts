import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/feeds/opensearch-valid.js';
import { runHint } from '../../helpers/run-hint.js';

const OPENSEARCH = `<?xml version="1.0"?><OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"><ShortName>Search</ShortName><Url type="text/html" template="https://x.test/?q={searchTerms}"/></OpenSearchDescription>`;

const site = (doc: { body?: string; status?: number } | null) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: '<!doctype html><html lang="en"><head><title>t</title><link rel="search" type="application/opensearchdescription+xml" href="/os.xml"></head><body></body></html>',
  },
  ...(doc
    ? {
        '/os.xml': {
          status: doc.status ?? 200,
          headers: {
            'content-type': 'application/opensearchdescription+xml',
          },
          body: doc.body ?? '',
        },
      }
    : {}),
});

describe('opensearch-valid', () => {
  it('passes a discovered well-formed description', async () => {
    expect(await runHint(hint, site({ body: OPENSEARCH }))).toEqual([]);
  });

  it('does nothing when no description is discovered', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a description with the wrong root element', async () => {
    const problems = await runHint(hint, site({ body: '<feed></feed>' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('must be <OpenSearchDescription>');
    expect(problems[0].resource).toContain('/os.xml');
  });

  it('reports a description that cannot be fetched', async () => {
    const problems = await runHint(hint, site({ status: 500, body: 'x' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('HTTP 500');
  });
});
