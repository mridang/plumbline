import { describe, expect, it } from '@jest/globals';
import {
  cspMetaContents,
  findMainDocument,
  headerBagFromRecord,
  metaHttpEquivContents,
  referrerSources,
  type MetaElementArtifact,
} from '../src/adapt.js';

/** The structural shape of a network record the header adapters read. */
type RecordLike = {
  url: string;
  resourceType?: string;
  responseHeaders?: { name: string; value: string }[];
};

/** The array type `findMainDocument` accepts, built from {@link RecordLike}. */
type Records = Parameters<typeof findMainDocument>[0];

const records = (...list: RecordLike[]): Records => list as unknown as Records;

const record = (r: RecordLike): Parameters<typeof headerBagFromRecord>[0] =>
  r as unknown as Parameters<typeof headerBagFromRecord>[0];

describe('headerBagFromRecord', () => {
  it('lower-cases names and keeps a header sent twice as an array', () => {
    const bag = headerBagFromRecord(
      record({
        url: 'https://x.test/',
        responseHeaders: [
          { name: 'Content-Type', value: 'text/html' },
          { name: 'set-cookie', value: 'a=1' },
          { name: 'Set-Cookie', value: 'b=2' },
        ],
      }),
    );
    expect(bag['content-type']).toBe('text/html');
    expect(bag['set-cookie']).toEqual(['a=1', 'b=2']);
  });

  it('tolerates a record with no response headers', () => {
    expect(headerBagFromRecord(record({ url: 'https://x.test/' }))).toEqual({});
  });
});

describe('findMainDocument', () => {
  it('returns the last Document record that matches the main URL', () => {
    const found = findMainDocument(
      records(
        { url: 'https://x.test/', resourceType: 'Document' },
        { url: 'https://x.test/a.js', resourceType: 'Script' },
        { url: 'https://x.test/', resourceType: 'Document' },
      ),
      'https://x.test/',
    );
    expect(found?.url).toBe('https://x.test/');
  });

  it('falls back to the first record when nothing matches the URL', () => {
    const found = findMainDocument(
      records({ url: 'https://x.test/a.js', resourceType: 'Script' }),
      'https://x.test/',
    );
    expect(found?.url).toBe('https://x.test/a.js');
  });

  it('returns null when there are no records', () => {
    expect(findMainDocument(records(), 'https://x.test/')).toBeNull();
  });
});

const metas = (...list: MetaElementArtifact[]): MetaElementArtifact[] => list;

describe('metaHttpEquivContents', () => {
  it('returns the content of matching http-equiv meta tags', () => {
    expect(
      metaHttpEquivContents(
        metas(
          { httpEquiv: 'Cross-Origin-Resource-Policy', content: 'same-origin' },
          { httpEquiv: 'refresh', content: '5' },
        ),
        'cross-origin-resource-policy',
      ),
    ).toEqual(['same-origin']);
  });
});

describe('cspMetaContents', () => {
  it('returns only non-empty CSP meta contents', () => {
    expect(
      cspMetaContents(
        metas(
          {
            httpEquiv: 'Content-Security-Policy',
            content: "default-src 'self'",
          },
          { httpEquiv: 'Content-Security-Policy', content: ' '.repeat(3) },
          { name: 'description', content: 'ignored' },
        ),
      ),
    ).toEqual(["default-src 'self'"]);
  });
});

describe('referrerSources', () => {
  it('collects meta name, meta http-equiv and header values', () => {
    const sources = referrerSources(
      metas(
        { name: 'referrer', content: 'no-referrer' },
        { httpEquiv: 'Referrer-Policy', content: 'origin' },
      ),
      ['strict-origin-when-cross-origin'],
    );
    expect(sources.metaName).toEqual(['no-referrer']);
    expect(sources.metaHttpEquiv).toEqual(['origin']);
    expect(sources.header).toEqual(['strict-origin-when-cross-origin']);
  });
});
