import { createHTMLDocument } from '@hint/utils-dom';
import { describe, expect, it } from '@jest/globals';
import type { Artifacts } from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { feedsChecks } from '../../src/checks/feeds.js';
import type { AuditCheck } from '../../src/checks/types.js';
// The single-source rules the webhint hints call. Running the Lighthouse check
// through its own HTML parser and asserting the findings match these proves the
// check and the hint cannot diverge.
import {
  feedDiscovery,
  oembedDiscovery,
  opensearchDiscovery,
} from '@mridang/webhint-hint-plumbline/dist/lib/feeds/checks.js';
import type { DocumentLike } from '@mridang/webhint-hint-plumbline/dist/lib/feeds/read.js';

const parse = (html: string): DocumentLike =>
  createHTMLDocument(html, 'https://x.test/') as DocumentLike;

/** Builds the artifacts the feed-discovery checks read. */
function artifacts(html: string): Artifacts {
  const url = 'https://x.test/';
  return {
    MainDocumentContent: html,
    URL: { mainDocumentUrl: url, finalDisplayedUrl: url },
  } as Artifacts;
}

const context = {} as AuditNS.Context;

const checkById = (id: string): AuditCheck => {
  const check = feedsChecks.find((c) => c.id === id);
  if (!check) {
    throw new Error(`no check ${id}`);
  }
  return check;
};

describe('feeds checks', () => {
  it('registers the three plugin-able discovery checks, all informative', () => {
    expect(feedsChecks.map((c) => c.id)).toEqual([
      'feed-discovery',
      'oembed-discovery',
      'opensearch-discovery',
    ]);
    expect(feedsChecks.every((c) => c.scoreMode === 'informative')).toBe(true);
    expect(feedsChecks.every((c) => c.section === 'feeds')).toBe(true);
  });

  it('returns null when the main document is absent', async () => {
    expect(
      await checkById('feed-discovery').run({} as Artifacts, context),
    ).toBeNull();
  });

  it('feed-discovery matches the shared rule', async () => {
    const html =
      '<link rel="alternate" type="application/atom+xml" href="/a.xml">';
    expect(
      await checkById('feed-discovery').run(artifacts(html), context),
    ).toEqual(feedDiscovery(parse(html)));
  });

  it('oembed-discovery matches the shared rule', async () => {
    const html = '<head></head>';
    expect(
      await checkById('oembed-discovery').run(artifacts(html), context),
    ).toEqual(oembedDiscovery(parse(html)));
  });

  it('opensearch-discovery matches the shared rule', async () => {
    const html =
      '<link rel="search" type="application/opensearchdescription+xml" href="https://x.test/os.xml">';
    expect(
      await checkById('opensearch-discovery').run(artifacts(html), context),
    ).toEqual(opensearchDiscovery(parse(html)));
  });
});
