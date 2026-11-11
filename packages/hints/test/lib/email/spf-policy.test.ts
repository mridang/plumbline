import { describe, expect, it } from '@jest/globals';
import {
  checkSpfPolicy,
  type SpfResolver,
} from '../../../src/lib/email/spf-policy.js';

/** Resolves from a table; a missing entry gives null, `Error` throws. */
const resolver =
  (table: Record<string, string | Error>): SpfResolver =>
  (domain) => {
    const entry = table[domain];
    if (entry instanceof Error) {
      return Promise.reject(entry);
    }
    return Promise.resolve(entry ?? null);
  };

const check = (record: string, table: Record<string, string | Error> = {}) =>
  checkSpfPolicy('example.com', record, resolver(table));

describe('checkSpfPolicy', () => {
  it.each(['v=spf1 -all', 'v=spf1 ~all', 'v=spf1 mx a ip4:192.0.2.1 -all'])(
    'accepts %s',
    async (record) => {
      const result = await check(record);
      expect(result.status).toBe('valid');
    },
  );

  it('rejects invalid syntax', async () => {
    const result = await check('v=spf1 bogus -all');
    expect(result.status).toBe('invalid_syntax');
    expect(result.records).toEqual([
      { domain: 'example.com', record: 'v=spf1 bogus -all' },
    ]);
  });

  it.each(['v=spf1 +all', 'v=spf1 all', 'v=spf1 ?all', 'v=spf1 mx'])(
    'rejects the weak policy %s',
    async (record) => {
      const result = await check(record);
      expect(result.status).toBe('invalid_all');
    },
  );

  it.each([
    {
      name: 'rejects a record without terms',
      record: 'v=spf1',
      status: 'invalid_all',
    },
    {
      name: 'ignores terms after all',
      record: 'v=spf1 -all +all',
      status: 'valid',
    },
  ])('$name', async ({ record, status }) => {
    const result = await check(record);
    expect(result.status).toBe(status);
  });

  it('counts a, mx, ptr and exists as lookups', async () => {
    const ten = 'a mx ptr exists:x.com a mx ptr exists:y.com a mx';
    const result = await check(`v=spf1 ${ten} -all`);
    expect(result.status).toBe('valid');
    expect(result.lookupsLeft).toBe(0);
    const eleven = await check(`v=spf1 ${ten} a -all`);
    expect(eleven.status).toBe('max_dns_lookups');
    expect(eleven.lookupsLeft).toBe(-1);
  });

  it('does not count ip4, ip6 and exp as lookups', async () => {
    const result = await check(
      'v=spf1 ip4:192.0.2.1 ip6:::1 exp=e.example.com -all',
    );
    expect(result.lookupsLeft).toBe(10);
  });

  it('follows an include', async () => {
    const result = await check('v=spf1 include:_spf.x.com -all', {
      '_spf.x.com': 'v=spf1 ip4:192.0.2.0/24 ~all',
    });
    expect(result.status).toBe('valid');
    expect(result.lookupsLeft).toBe(9);
  });

  it('accepts ?all inside an include only', async () => {
    const included = await check('v=spf1 include:x.com -all', {
      'x.com': 'v=spf1 ?all',
    });
    expect(included.status).toBe('valid');
    const top = await check('v=spf1 ?all');
    expect(top.status).toBe('invalid_all');
  });

  it('rejects +all inside an include', async () => {
    const result = await check('v=spf1 include:x.com -all', {
      'x.com': 'v=spf1 +all',
    });
    expect(result.status).toBe('invalid_include');
    expect(result.records.map((r) => r.domain)).toEqual([
      'x.com',
      'example.com',
    ]);
  });

  it('accepts an include without all', async () => {
    const result = await check('v=spf1 include:x.com -all', {
      'x.com': 'v=spf1 ip4:192.0.2.1',
    });
    expect(result.status).toBe('valid');
  });

  it('rejects an include that does not exist or fails', async () => {
    const missing = await check('v=spf1 include:gone.com -all');
    expect(missing.status).toBe('invalid_include');
    const failing = await check('v=spf1 include:down.com -all', {
      'down.com': new Error('servfail'),
    });
    expect(failing.status).toBe('invalid_include');
  });

  it('rejects an include with invalid syntax', async () => {
    const result = await check('v=spf1 include:x.com -all', {
      'x.com': 'v=spf1 nonsense',
    });
    expect(result.status).toBe('invalid_include');
  });

  it('does not follow macros', async () => {
    const result = await check('v=spf1 include:%{d}.x.com -all');
    expect(result.status).toBe('valid');
  });

  it('follows a redirect when there is no all', async () => {
    const result = await check('v=spf1 redirect=_spf.x.com', {
      '_spf.x.com': 'v=spf1 -all',
    });
    expect(result.status).toBe('valid');
  });

  it('rejects a redirect to a weak or missing policy', async () => {
    const weak = await check('v=spf1 redirect=x.com', {
      'x.com': 'v=spf1 +all',
    });
    expect(weak.status).toBe('invalid_redirect');
    const missing = await check('v=spf1 redirect=gone.com');
    expect(missing.status).toBe('invalid_redirect');
  });

  it('ignores a redirect when all is present', async () => {
    const result = await check('v=spf1 -all redirect=gone.com');
    expect(result.status).toBe('valid');
  });

  it('reports the lookup limit across nested includes', async () => {
    const table: Record<string, string> = {
      'a.com': 'v=spf1 include:b.com a a a a a -all',
      'b.com': 'v=spf1 mx mx mx -all',
    };
    const ok = await check('v=spf1 include:a.com -all', table);
    expect(ok.status).toBe('valid');
    const tooMany = await check('v=spf1 include:a.com mx mx -all', table);
    expect(tooMany.status).toBe('max_dns_lookups');
  });

  it('stops on a self-referencing include through the lookup limit', async () => {
    const result = await check('v=spf1 include:loop.com -all', {
      'loop.com': 'v=spf1 include:loop.com -all',
    });
    expect(result.status).toBe('max_dns_lookups');
  });
});
