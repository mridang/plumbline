import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import { dns } from '../../../src/core/dns.js';
import hint from '../../../src/hints/agent/agent-dns-aid.js';
import { runHint } from '../../helpers/run-hint.js';

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

describe('agent-dns-aid', () => {
  it('passes when the site provides it', async () => {
    answers['SVCB _mcp._agents.127.0.0.1'] = ['1 mcp.example.com. alpn=h2'];
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].sourceCode).toContain('_agents.');
  });
});
