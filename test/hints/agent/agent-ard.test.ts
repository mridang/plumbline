import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import { dns } from '../../../src/core/dns.js';
import hint from '../../../src/hints/agent/agent-ard.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const json = (value: unknown) => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});

const routes: Routes = {
  '/.well-known/ard.json': json({
    specVersion: '1.0',
    host: {},
    entries: [
      {
        identifier: 'urn:air:example.com:tools:search',
        displayName: 'S',
        type: 'application/mcp-server-card+json',
        url: 'https://example.com/mcp',
        representativeQueries: ['a', 'b'],
      },
    ],
  }),
};

const original = dns.client;
const answers: Record<string, string[]> = {};

beforeEach(() => {
  dns.client = {
    query: (name, type) =>
      Promise.resolve({
        status: 0,
        authenticated: false,
        answers: (answers[`${type} ${name}`] ?? []).map((data) => ({
          name,
          type: 0,
          ttl: 1,
          data,
        })),
        authority: [],
      }),
  };
});

afterEach(() => {
  dns.client = original;
  for (const key of Object.keys(answers)) delete answers[key];
});

describe('agent-ard', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
