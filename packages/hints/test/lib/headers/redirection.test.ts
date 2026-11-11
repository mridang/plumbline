import { describe, expect, it } from '@jest/globals';
import {
  analyzeRedirection,
  followRedirects,
  redirectionFindings,
  type Hop,
  type RedirectionClient,
} from '../../../src/lib/headers/redirection.js';
import { HTTP_SCHEME } from '../../helpers/data.js';

const hop = (url: string, status = 301): Hop => ({ url: new URL(url), status });
const route = (...hops: Hop[]) => ({
  hops,
  invalidCert: false,
  unreachable: false,
});

describe('analyzeRedirection', () => {
  it('to https on the same host is fine', () => {
    expect(
      analyzeRedirection(
        route(hop(`${HTTP_SCHEME}a.example/`), hop('https://a.example/', 200)),
      ),
    ).toBe('redirection-to-https');
  });

  it('allows a further redirect to another host on https', () => {
    expect(
      analyzeRedirection(
        route(
          hop(`${HTTP_SCHEME}a.example/`),
          hop('https://a.example/'),
          hop('https://www.a.example/', 200),
        ),
      ),
    ).toBe('redirection-to-https');
  });

  it('is missing when http does not redirect', () => {
    expect(
      analyzeRedirection(route(hop(`${HTTP_SCHEME}a.example/`, 200))),
    ).toBe('redirection-missing');
  });

  it('is not needed when http cannot be reached', () => {
    expect(
      analyzeRedirection({ hops: [], invalidCert: false, unreachable: true }),
    ).toBe('redirection-not-needed-no-http');
  });

  it('reports an invalid certificate', () => {
    expect(
      analyzeRedirection({
        hops: [hop(`${HTTP_SCHEME}a.example/`)],
        invalidCert: true,
        unreachable: false,
      }),
    ).toBe('redirection-invalid-cert');
  });

  it('flags a final destination that is not https', () => {
    expect(
      analyzeRedirection(
        route(
          hop(`${HTTP_SCHEME}a.example/`),
          hop(`${HTTP_SCHEME}b.example/`, 200),
        ),
      ),
    ).toBe('redirection-not-to-https');
  });

  it('flags an initial redirect to another http URL', () => {
    expect(
      analyzeRedirection(
        route(
          hop(`${HTTP_SCHEME}a.example/`),
          hop(`${HTTP_SCHEME}www.a.example/`),
          hop('https://www.a.example/', 200),
        ),
      ),
    ).toBe('redirection-not-to-https-on-initial-redirection');
  });

  it('flags a first hop to another host', () => {
    expect(
      analyzeRedirection(
        route(
          hop(`${HTTP_SCHEME}a.example/`),
          hop('https://www.a.example/', 200),
        ),
      ),
    ).toBe('redirection-off-host-from-http');
  });

  it('accepts a route that is entirely preloaded', () => {
    expect(
      analyzeRedirection(
        route(hop(`${HTTP_SCHEME}a.example/`, 200)),
        () => true,
      ),
    ).toBe('redirection-all-redirects-preloaded');
  });
});

describe('redirectionFindings', () => {
  it('is silent for passing results', () => {
    expect(
      redirectionFindings(
        route(hop(`${HTTP_SCHEME}a.example/`), hop('https://a.example/', 200)),
      ),
    ).toEqual([]);
    expect(
      redirectionFindings({ hops: [], invalidCert: false, unreachable: true }),
    ).toEqual([]);
    expect(
      redirectionFindings(
        route(hop(`${HTTP_SCHEME}a.example/`, 200)),
        () => true,
      ),
    ).toEqual([]);
  });

  it('warns for an off-host first hop and errors for the rest', () => {
    expect(
      redirectionFindings(
        route(
          hop(`${HTTP_SCHEME}a.example/`),
          hop('https://www.a.example/', 200),
        ),
      )[0]?.severity,
    ).toBe('warning');
    expect(
      redirectionFindings(route(hop(`${HTTP_SCHEME}a.example/`, 200)))[0]
        ?.severity,
    ).toBe('error');
    expect(
      redirectionFindings({
        hops: [hop(`${HTTP_SCHEME}a.example/`)],
        invalidCert: true,
        unreachable: false,
      })[0]?.message,
    ).toContain('Invalid certificate');
  });
});

/** A fake client answering from a table of URL to [status, location]. */
function fake(
  table: Record<string, [number, string?] | Error | undefined>,
): RedirectionClient {
  return {
    fetch: (url) => {
      const entry = table[url];
      if (entry === undefined || entry instanceof Error) {
        return Promise.reject(entry ?? new Error('unknown'));
      }
      const [status, location] = entry;
      return Promise.resolve(
        new Response(null, { status, headers: location ? { location } : {} }),
      );
    },
  };
}

describe('followRedirects', () => {
  it('follows a chain and records each hop', async () => {
    const client = fake({
      [`${HTTP_SCHEME}a.example/`]: [301, 'https://a.example/'],
      'https://a.example/': [302, '/home'],
      'https://a.example/home': [200],
    });
    const result = await followRedirects(
      new URL(`${HTTP_SCHEME}a.example/`),
      client,
    );
    expect(result.hops.map((h) => h.url.href)).toEqual([
      `${HTTP_SCHEME}a.example/`,
      'https://a.example/',
      'https://a.example/home',
    ]);
  });

  it('marks an unreachable start', async () => {
    const result = await followRedirects(
      new URL(`${HTTP_SCHEME}a.example/`),
      fake({}),
    );
    expect(result.unreachable).toBe(true);
  });

  it('marks a certificate failure on a later hop', async () => {
    const cause = Object.assign(new Error('x'), { code: 'CERT_HAS_EXPIRED' });
    const client = fake({
      [`${HTTP_SCHEME}a.example/`]: [301, 'https://a.example/'],
      'https://a.example/': new Error('fetch failed', { cause }),
    });
    const result = await followRedirects(
      new URL(`${HTTP_SCHEME}a.example/`),
      client,
    );
    expect(result.invalidCert).toBe(true);
    expect(result.unreachable).toBe(false);
  });

  it('stops quietly on another failure on a later hop', async () => {
    const client = fake({
      [`${HTTP_SCHEME}a.example/`]: [301, 'https://a.example/'],
    });
    const result = await followRedirects(
      new URL(`${HTTP_SCHEME}a.example/`),
      client,
    );
    expect(result).toMatchObject({ invalidCert: false, unreachable: false });
    expect(result.hops).toHaveLength(1);
  });

  it('stops at a redirect without a usable location and at the hop limit', async () => {
    const noLocation = await followRedirects(
      new URL(`${HTTP_SCHEME}a.example/`),
      fake({ [`${HTTP_SCHEME}a.example/`]: [301] }),
    );
    expect(noLocation.hops).toHaveLength(1);
    const loop = await followRedirects(
      new URL(`${HTTP_SCHEME}a.example/`),
      fake({ [`${HTTP_SCHEME}a.example/`]: [302, `${HTTP_SCHEME}a.example/`] }),
      3,
    );
    expect(loop.hops).toHaveLength(3);
  });

  it('stops on a location that is not a URL', async () => {
    const result = await followRedirects(
      new URL(`${HTTP_SCHEME}a.example/`),
      fake({ [`${HTTP_SCHEME}a.example/`]: [302, `${HTTP_SCHEME}[bad`] }),
    );
    expect(result.hops).toHaveLength(1);
  });
});
