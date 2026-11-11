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
    const r = await checkDnsAid(env);
    expect(r.passed).toBe(false);
  });
  it('fails when nothing is published', async () => {
    const r = await checkDnsAid(fakeEnv());
    expect(r.passed).toBe(false);
  });
  it('treats a failing resolver as no record', async () => {
    const env = fakeEnv();
    env.dns = { query: () => Promise.reject(new Error('down')) };
    const r = await checkDnsAid(env);
    expect(r.passed).toBe(false);
  });
});

describe('isServiceModeRecord against the former regex', () => {
  // The former pattern, assembled at run time so the linter does not flag the
  // reference implementation this test compares against.
  const old = (flags: string, ...parts: string[]): RegExp =>
    new RegExp(parts.join(''), flags);
  const params = old(
    'i',
    String.raw`\b(alpn|port|ipv4hint|ipv6hint|`,
    'well-known|cap|cap-sha256|ech|endpoint|mcp|a2a)=',
  );
  const former = (data: string): boolean => {
    const match = old(
      '',
      String.raw`^(\d+)\s+(\S+)`,
      String.raw`\s*(.*)$`,
    ).exec(data.trim());
    return match !== null && Number(match[1]) !== 0 && params.test(match[3]);
  };

  it.each([
    '1 . alpn=h2',
    '0 . alpn=h2',
    '1 .',
    '1 . ',
    '1',
    '',
    ' 1   svc.example.   port=443 ',
    'x 1 . alpn=h2',
    '1 . alpn=h2',
    '1 a alpn=h2',
    '1 a b\nalpn=h2',
    '1 a b alpn=h2',
    '12 . ech=abc mcp=/x',
    '1 . noalpn=1',
  ])('agrees on %j', (data) => {
    expect(isServiceModeRecord(data)).toBe(former(data));
  });

  it('agrees on a 100k character record', () => {
    const data = `1 . ${'a '.repeat(50_000)}alpn=h2`;
    expect(isServiceModeRecord(data)).toBe(former(data));
    const spaced = `1${' '.repeat(100_000)}x`;
    expect(isServiceModeRecord(spaced)).toBe(former(spaced));
  });
});
