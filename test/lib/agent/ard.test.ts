import { describe, expect, it } from '@jest/globals';
import {
  catalogProblems,
  checkArd,
  entryProblems,
} from '../../../src/lib/agent/ard.js';
import { fakeEnv, without } from './fake-env.js';

const entry = {
  identifier: 'urn:air:example.com:tools:search',
  displayName: 'Search',
  type: 'application/mcp-server-card+json',
  url: 'https://example.com/mcp',
  representativeQueries: ['find a thing', 'search things'],
};
const catalog = { entries: [entry] };
const legacy = { specVersion: '1.0', host: { name: 'x' }, entries: [entry] };

describe('entryProblems', () => {
  it('accepts a valid entry', () => {
    expect(entryProblems(entry)).toEqual([]);
  });
  it('accepts the older id field and an optional namespace', () => {
    const { identifier, ...rest } = entry;
    expect(entryProblems({ ...rest, id: identifier })).toEqual([]);
    expect(
      entryProblems({ ...entry, identifier: 'urn:air:example.com:a:b:c' }),
    ).toEqual([]);
  });
  it('rejects identifiers that are not urn:air:<fqdn>:<name>', () => {
    for (const identifier of [
      'nope',
      'urn:air:example.com',
      'urn:air:localhost:x',
      undefined,
    ]) {
      expect(entryProblems({ ...entry, identifier })).toHaveLength(1);
    }
  });
  it('rejects both url and data, and neither', () => {
    expect(entryProblems({ ...entry, data: {} })).toContain(
      'exactly one of url and data is required',
    );
    const none = without(entry, 'url');
    expect(entryProblems(none)).toContain(
      'exactly one of url and data is required',
    );
  });
  it('does not fail representativeQueries counts (the spec only warns)', () => {
    expect(entryProblems({ ...entry, representativeQueries: ['a'] })).toEqual(
      [],
    );
  });
  it('requires a media type and a display name', () => {
    expect(entryProblems({ ...entry, type: 'mcp' })).toHaveLength(1);
    expect(entryProblems({ ...entry, displayName: '' })).toHaveLength(1);
  });
  it('rejects non-objects', () => {
    expect(entryProblems('x')).toEqual(['entry is not an object']);
  });
});

describe('catalogProblems', () => {
  it('only requires entries', () => {
    expect(catalogProblems({})).toEqual(['entries is empty']);
    expect(catalogProblems(catalog)).toEqual([]);
  });
  it('also requires specVersion and host in the older format', () => {
    expect(catalogProblems({ entries: [entry] }, true)).toEqual([
      'specVersion is missing',
      'host is missing',
    ]);
    expect(catalogProblems(legacy, true)).toEqual([]);
  });
  it('prefixes entry problems with their index', () => {
    expect(catalogProblems({ entries: [{ ...entry, type: '' }] })[0]).toContain(
      'entry 0',
    );
  });
});

describe('checkArd', () => {
  it('passes with the well-known catalog', async () => {
    expect(
      (await checkArd(fakeEnv({ '/.well-known/ard.json': catalog }))).passed,
    ).toBe(true);
  });
  it('still accepts the older ai-catalog.json, but then needs specVersion and host', async () => {
    expect(
      (await checkArd(fakeEnv({ '/.well-known/ai-catalog.json': legacy })))
        .passed,
    ).toBe(true);
    expect(
      (await checkArd(fakeEnv({ '/.well-known/ai-catalog.json': catalog })))
        .detail,
    ).toContain('specVersion');
  });
  it('finds a catalog through an Agentmap directive', async () => {
    const env = fakeEnv({
      '/robots.txt': 'Agentmap: https://example.com/cat.json',
      'https://example.com/cat.json': catalog,
    });
    expect((await checkArd(env)).passed).toBe(true);
  });
  it('finds a catalog through a link element', async () => {
    const env = fakeEnv({
      '/': '<link rel="ard" href="/c.json">',
      '/c.json': catalog,
    });
    expect((await checkArd(env)).passed).toBe(true);
  });
  it('finds a catalog through DNS TXT', async () => {
    const env = fakeEnv(
      { 'https://example.com/d.json': catalog },
      {
        dnsAnswers: {
          'TXT _catalog._agents.example.com': [
            '"url=https://example.com/d.json"',
          ],
        },
      },
    );
    expect((await checkArd(env)).passed).toBe(true);
  });
  it('reports the first problem of an invalid catalog', async () => {
    const env = fakeEnv({
      '/.well-known/ard.json': { ...catalog, entries: [] },
    });
    expect((await checkArd(env)).detail).toContain('entries is empty');
  });
  it('fails when no catalog is found, even if DNS errors', async () => {
    const env = fakeEnv();
    env.dns = { query: () => Promise.reject(new Error('down')) };
    expect((await checkArd(env)).detail).toContain(
      '/.well-known/ard.json was not found',
    );
  });
});
