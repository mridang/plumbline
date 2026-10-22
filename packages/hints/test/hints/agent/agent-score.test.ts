import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import { dns } from '../../../src/core/dns.js';
import hint from '../../../src/hints/agent/agent-score.js';
import { agentHints } from '../../../src/hints/agent/index.js';
import { runHint } from '../../helpers/run-hint.js';
import { setEvaluate } from '../../helpers/test-connector.js';

const original = dns.client;

beforeEach(() => {
  dns.client = {
    query: () =>
      Promise.resolve({
        status: 3,
        authenticated: false,
        answers: [],
        authority: [],
      }),
  };
  setEvaluate(() => ({ api: false, tools: 0, forms: 0 }));
});

afterEach(() => {
  dns.client = original;
});

describe('agent-score', () => {
  it('reports one informational message with score, level and categories', async () => {
    const problems = await runHint(hint, {
      '/robots.txt': {
        headers: { 'content-type': 'text/plain' },
        body: 'User-agent: GPTBot\nSitemap: /sitemap.xml',
      },
      '/sitemap.xml': { body: '<urlset></urlset>' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    const { message } = problems[0];
    expect(message).toContain('Agent readiness score');
    expect(message).toContain('level 1 "Basic Web Presence"');
    expect(message).toContain('Discoverability 50 (2/4)');
    expect(message).toContain('Bot Access Control 50 (1/2)');
    expect(message).toContain('Commerce not checked');
  });

  it('scores 0 for a bare site', async () => {
    const [problem] = await runHint(hint, {});
    expect(problem.message).toContain('score 0/100, level 0');
  });
});

describe('agentHints', () => {
  it('lists the score hint and 22 checks, all in agent-ready and agent', () => {
    expect(agentHints).toHaveLength(23);
    expect(agentHints.map((h) => h.id)).toContain('agent-score');
    for (const h of agentHints) {
      expect(h.groups).toEqual(
        expect.arrayContaining(['agent-ready', 'agent']),
      );
    }
  });
});
