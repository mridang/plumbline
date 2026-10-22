import { describe, expect, it } from '@jest/globals';
import {
  checkLinkHeaders,
  parseLinkHeader,
} from '../../../src/lib/agent/link-headers.js';
import { fakeEnv } from './fake-env.js';

const home = (link?: string) =>
  fakeEnv({ '/': { headers: link ? { link } : {}, body: '' } });

describe('parseLinkHeader', () => {
  it('splits links and relations, honouring quotes and commas in URIs', () => {
    expect(
      parseLinkHeader(
        '</a,b>; rel="service-desc status"; title="x, y", <https://e.com/c>; rel=preconnect',
      ),
    ).toEqual([
      { target: '/a,b', rels: ['service-desc', 'status'] },
      { target: 'https://e.com/c', rels: ['preconnect'] },
    ]);
  });
  it('skips malformed parts', () => {
    expect(parseLinkHeader('nonsense')).toEqual([]);
  });
});

describe('checkLinkHeaders', () => {
  it('passes with an agent relation', async () => {
    const r = await checkLinkHeaders(
      home('</.well-known/api-catalog>; rel="api-catalog"'),
    );
    expect(r.passed).toBe(true);
  });
  it('accepts the ard relation and the IANA service relations', async () => {
    for (const rel of ['ard', 'service-meta', 'describedby', 'status']) {
      expect((await checkLinkHeaders(home(`</x>; rel="${rel}"`))).passed).toBe(
        true,
      );
    }
  });
  it('fails with preconnect alone', async () => {
    const r = await checkLinkHeaders(
      home('<https://cdn.example>; rel=preconnect'),
    );
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('no agent-useful relation');
  });
  it('fails without a Link header', async () => {
    expect((await checkLinkHeaders(home())).detail).toContain('no Link header');
  });
  it('fails when the page is unreachable', async () => {
    expect((await checkLinkHeaders(fakeEnv())).passed).toBe(false);
  });
});
