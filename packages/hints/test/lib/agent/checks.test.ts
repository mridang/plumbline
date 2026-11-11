import { describe, expect, it } from '@jest/globals';
import { CHECKS, checkById, runCheck } from '../../../src/lib/agent/checks.js';
import { fakeEnv } from './fake-env.js';

describe('CHECKS', () => {
  it('has 22 unique ids that all start with agent-', () => {
    const ids = CHECKS.map((c) => c.id);
    expect(ids).toHaveLength(22);
    expect(new Set(ids).size).toBe(22);
    expect(ids.every((id) => id.startsWith('agent-'))).toBe(true);
  });
  it('leaves Web Bot Auth, ARD and Poppy out of the score', () => {
    expect(CHECKS.filter((c) => !c.scored).map((c) => c.id)).toEqual([
      'agent-web-bot-auth',
      'agent-ard',
      'agent-poppy',
    ]);
  });
  it('runs every check against an empty site without throwing', async () => {
    for (const check of CHECKS) {
      const r = await runCheck(check, fakeEnv());
      expect(r.id).toBe(check.id);
      expect(r.category).toBe(check.category);
      expect(r.passed).toBe(false);
    }
  });
});

describe('a site answering every missing path with a JSON 404', () => {
  const env = () =>
    fakeEnv(
      {},
      {
        fallback: {
          status: 404,
          contentType: 'application/json',
          body: '{"error":"not_found","specVersion":"1","entries":[1],"skills":[1],"issuer":"https://example.com"}',
        },
      },
    );
  it.each(CHECKS.map((c) => [c.id]))('%s fails', async (id) => {
    const r = await runCheck(checkById(id), env());
    expect(r.passed).toBe(false);
  });
  it.each([
    ['agent-poppy', '/.well-known/poppy.json'],
    ['agent-ard', '/.well-known/ard.json'],
    ['agent-skills', '/.well-known/agent-skills/index.json'],
    ['agent-mcp-server-card', '/.well-known/mcp/server-card.json'],
    ['agent-a2a-agent-card', '/.well-known/agent-card.json'],
    ['agent-api-catalog', '/.well-known/api-catalog'],
    ['agent-oauth-protected-resource', '/.well-known/oauth-protected-resource'],
    ['agent-web-bot-auth', '/.well-known/http-message-signatures-directory'],
    ['agent-auth-md', '/auth.md'],
    ['agent-ucp', '/.well-known/ucp'],
    ['agent-acp', '/.well-known/acp.json'],
    ['agent-robots-txt', '/robots.txt'],
    ['agent-ai-bot-rules', '/robots.txt'],
    ['agent-content-signals', '/robots.txt'],
  ])('%s says the path was not found (HTTP 404)', async (id, path) => {
    const r = await runCheck(checkById(id), env());
    expect(r.detail).toContain(`${path} was not found (HTTP 404)`);
  });
  it('treats a 200 with an HTML page as not found', async () => {
    const html = {
      contentType: 'text/html',
      body: '{"issuer":"https://example.com"}',
    };
    const e = fakeEnv({}, { fallback: html });
    for (const id of [
      'agent-poppy',
      'agent-skills',
      'agent-oauth-discovery',
      'agent-web-bot-auth',
    ]) {
      const r = await runCheck(checkById(id), e);
      expect(r.passed).toBe(false);
    }
  });
});

describe('checkById', () => {
  it('finds a check and throws for an unknown id', () => {
    expect(checkById('agent-sitemap').category).toBe('discoverability');
    expect(() => checkById('nope')).toThrow('Unknown agent check');
  });
});

describe('runCheck', () => {
  it('turns a throwing check into a failed result', async () => {
    const check = {
      ...checkById('agent-sitemap'),
      run: () => Promise.reject(new Error('boom')),
    };
    const r = await runCheck(check, fakeEnv());
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('boom');
  });
});
