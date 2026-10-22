import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/feeds/feed-valid.js';
import { runHint } from '../../helpers/run-hint.js';

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title><link>https://x.test/</link><description>D</description></channel></rss>`;

/** A page that declares an RSS feed at /feed.xml, plus the feed route. */
const site = (feed: { body?: string; status?: number } | null) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: '<!doctype html><html lang="en"><head><title>t</title><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head><body></body></html>',
  },
  ...(feed
    ? {
        '/feed.xml': {
          status: feed.status ?? 200,
          headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
          body: feed.body ?? '',
        },
      }
    : {}),
});

describe('feed-valid', () => {
  it('passes a discovered well-formed feed', async () => {
    expect(await runHint(hint, site({ body: RSS }))).toEqual([]);
  });

  it('does nothing when no feed is discovered', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a malformed feed', async () => {
    const problems = await runHint(hint, site({ body: '<rss></rss>' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no <channel>');
    expect(problems[0].resource).toContain('/feed.xml');
  });

  it('reports a feed that cannot be fetched', async () => {
    const problems = await runHint(hint, site({ status: 404, body: 'x' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('HTTP 404');
  });
});
