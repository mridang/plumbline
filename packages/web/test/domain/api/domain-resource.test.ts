import { describe, expect, it } from '@jest/globals';

import {
  domainResource,
  isDomainId,
  parseCheckNames,
  parseDomainInput,
  parseDomainPatch,
  parseHost,
  unknownFields,
} from '@/domain/api/domain-resource';
import { CHECKS, checksInGroup } from '@/domain/checks/catalogue';
import type { Domain } from '@/domain/db/domains';

const domain: Domain = {
  id: '00000000-0000-4000-8000-000000000001',
  user_id: 1,
  host: 'example.com',
  checks: ['accept-ch', 'gone-check'],
  repo: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

describe('domainResource', () => {
  it('shows the domain without its owner', () => {
    expect(domainResource(domain)).toEqual({
      id: domain.id,
      host: 'example.com',
      all_checks: false,
      checks: ['accept-ch'],
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    });
  });

  it('lists every check for a domain that runs them all', () => {
    expect(domainResource({ ...domain, checks: null })).toMatchObject({
      all_checks: true,
      checks: CHECKS.map((check) => check.id),
    });
  });
});

describe('parseHost', () => {
  it('takes a bare domain, lower-cased', () => {
    expect(parseHost('Example.COM')).toEqual({
      ok: true,
      value: 'example.com',
    });
  });

  it('takes the host of a URL on the domain', () => {
    expect(parseHost('https://www.example.com/a?b')).toEqual({
      ok: true,
      value: 'www.example.com',
    });
  });

  it('drops a trailing dot', () => {
    expect(parseHost('example.com.')).toEqual({
      ok: true,
      value: 'example.com',
    });
  });

  it('requires a value', () => {
    expect(parseHost(undefined)).toEqual({
      ok: false,
      errors: ['host: required.'],
    });
  });

  it('requires text', () => {
    expect(parseHost(42)).toEqual({ ok: false, errors: ['host: required.'] });
  });

  it('refuses blank text', () => {
    expect(parseHost('   ')).toEqual({
      ok: false,
      errors: ['host: required.'],
    });
  });

  it('refuses an IP address, saying why under the field name', () => {
    expect(parseHost('127.0.0.1', 'domain')).toEqual({
      ok: false,
      errors: ['domain: Enter a domain name, not an IP address.'],
    });
  });
});

describe('parseDomainInput', () => {
  it('reads the host field', () => {
    expect(parseDomainInput({ host: 'example.com' })).toEqual({
      ok: true,
      value: 'example.com',
    });
  });

  it('refuses a body with no host', () => {
    expect(parseDomainInput({})).toEqual({
      ok: false,
      errors: ['host: required.'],
    });
  });
});

describe('parseCheckNames', () => {
  it('takes check ids', () => {
    expect(parseCheckNames(['accept-ch'], 'checks')).toEqual({
      ok: true,
      value: ['accept-ch'],
    });
  });

  it('expands a group into its checks', () => {
    expect(parseCheckNames(['email'], 'checks')).toEqual({
      ok: true,
      value: checksInGroup('email').map((check) => check.id),
    });
  });

  it('trims each name', () => {
    expect(parseCheckNames([' accept-ch '], 'checks')).toEqual({
      ok: true,
      value: ['accept-ch'],
    });
  });

  it('refuses something that is not a list', () => {
    expect(parseCheckNames('accept-ch', 'checks')).toEqual({
      ok: false,
      errors: ['checks: must be a list of check ids or group names.'],
    });
  });

  it('refuses a list with something other than text', () => {
    expect(parseCheckNames(['accept-ch', 1], 'checks').ok).toBe(false);
  });

  it('refuses more than 500 names', () => {
    expect(parseCheckNames(Array(501).fill('accept-ch'), 'checks')).toEqual({
      ok: false,
      errors: ['checks: at most 500 entries.'],
    });
  });

  it('names what is neither a check nor a group', () => {
    expect(parseCheckNames(['accept-ch', 'nope'], 'enable')).toEqual({
      ok: false,
      errors: ['enable: "nope" is not a check or a group.'],
    });
  });

  it('names at most ten unknown names', () => {
    const names = Array.from({ length: 12 }, (_, n) => `nope-${n}`);
    const parsed = parseCheckNames(names, 'checks');
    expect(parsed.ok ? [] : parsed.errors).toHaveLength(10);
  });

  it('cuts a long unknown name short', () => {
    const parsed = parseCheckNames(['x'.repeat(200)], 'checks');
    expect(parsed.ok ? [] : parsed.errors).toEqual([
      `checks: "${'x'.repeat(80)}" is not a check or a group.`,
    ]);
  });
});

describe('parseDomainPatch', () => {
  it('takes a list of checks', () => {
    expect(parseDomainPatch({ checks: ['accept-ch'] })).toEqual({
      ok: true,
      value: ['accept-ch'],
    });
  });

  it('takes null for every check', () => {
    expect(parseDomainPatch({ checks: null })).toEqual({
      ok: true,
      value: null,
    });
  });

  it('requires checks', () => {
    expect(parseDomainPatch({})).toEqual({
      ok: false,
      errors: ['checks: required.'],
    });
  });

  it('refuses a change to anything else', () => {
    expect(parseDomainPatch({ checks: null, host: 'other.com' })).toEqual({
      ok: false,
      errors: ['host: cannot be changed.'],
    });
  });

  it('refuses checks that do not exist', () => {
    expect(parseDomainPatch({ checks: ['nope'] }).ok).toBe(false);
  });
});

describe('isDomainId', () => {
  it('takes a UUID', () => {
    expect(isDomainId('00000000-0000-4000-8000-000000000001')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isDomainId('1')).toBe(false);
  });

  it('refuses an upper-case UUID, which the app never makes', () => {
    expect(isDomainId('00000000-0000-4000-8000-00000000000A')).toBe(false);
  });
});

describe('unknownFields', () => {
  it('names each field that is not known, and nothing when there is none', () => {
    expect(unknownFields({ host: 'a', extra: 1, more: 2 }, ['host'])).toEqual([
      'extra: is not a field of this request.',
      'more: is not a field of this request.',
    ]);
    expect(unknownFields({ host: 'a' }, ['host'])).toEqual([]);
  });
});

describe('parseDomainInput, a field it does not know', () => {
  it('is refused, so a typo is not taken for a choice', () => {
    expect(parseDomainInput({ host: 'example.com', checks: [] })).toEqual({
      ok: false,
      errors: ['checks: is not a field of this request.'],
    });
  });
});
