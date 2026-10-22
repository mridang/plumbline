import { describe, expect, it } from '@jest/globals';
import {
  checkDnsAid,
  isServiceModeRecord,
} from '../../../src/lib/agent/dns-aid.js';
import { fakeEnv } from './fake-env.js';

describe('isServiceModeRecord', () => {
  it('accepts ServiceMode records with parameters', () => {
    expect(isServiceModeRecord('1 mcp.example.com. alpn=h2 port=443')).toBe(
      true,
    );
  });
  it('rejects AliasMode, parameterless and malformed records', () => {
    expect(isServiceModeRecord('0 mcp.example.com.')).toBe(false);
    expect(isServiceModeRecord('1 mcp.example.com.')).toBe(false);
    expect(isServiceModeRecord('garbage')).toBe(false);
  });
});

describe('checkDnsAid', () => {
  it('passes with an SVCB record at _mcp._agents', async () => {
    const env = fakeEnv(
      {},
      {
        dnsAnswers: {
          'SVCB _mcp._agents.example.com': ['1 mcp.example.com. alpn=h2'],
        },
      },
    );
    const r = await checkDnsAid(env);
    expect(r.passed).toBe(true);
    expect(r.detail).toContain('_mcp._agents.example.com');
  });
  it('does not count a TXT record alone', async () => {
    const env = fakeEnv(
      {},
      {
        dnsAnswers: { 'TXT _index._agents.example.com': ['"v=1"'] },
      },
    );
    expect((await checkDnsAid(env)).passed).toBe(false);
  });
  it('fails when nothing is published', async () => {
    expect((await checkDnsAid(fakeEnv())).passed).toBe(false);
  });
  it('treats a failing resolver as no record', async () => {
    const env = fakeEnv();
    env.dns = { query: () => Promise.reject(new Error('down')) };
    expect((await checkDnsAid(env)).passed).toBe(false);
  });
});
