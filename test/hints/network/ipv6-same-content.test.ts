import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/ipv6-same-content.js';
import { network, type WebResponse } from '../../../src/lib/network/ipv6.js';
import { installDns } from '../../lib/network/fake-dns.js';
import { runHint } from '../../helpers/run-hint.js';

const realGet = network.get;
let restore: () => void = () => undefined;
afterEach(() => {
  restore();
  network.get = realGet;
});
const dual = {
  'example.test': {
    A: { data: ['192.0.2.1'] },
    AAAA: { data: ['2001:db8::1'] },
  },
};
const serve = (v4: WebResponse | null, v6: WebResponse | null) => {
  network.get = async (_h, ip) => (ip.includes(':') ? v6 : v4);
};

describe('ipv6-same-content', () => {
  it('passes for identical content', async () => {
    restore = installDns(dual);
    serve({ status: 200, body: 'same' }, { status: 200, body: 'same' });
    expect(await runHint(hint)).toEqual([]);
  });

  it('reports different status codes as an error', async () => {
    restore = installDns(dual);
    serve({ status: 200, body: 'same' }, { status: 500, body: 'same' });
    const problems = await runHint(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('are not the same via IPv6');
    expect(problems[0].sourceCode).toContain('example.test. IN AAAA');
  });

  it('warns about different content', async () => {
    restore = installDns(dual);
    serve(
      { status: 200, body: 'a'.repeat(50) },
      { status: 200, body: 'b'.repeat(50) },
    );
    const problems = await runHint(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('HTML content');
    expect(problems[0].sourceCode).toContain('example.test. IN A ');
  });

  it('warns about identical error pages', async () => {
    restore = installDns(dual);
    serve({ status: 503, body: 'x' }, { status: 503, body: 'x' });
    const problems = await runHint(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('4xx or 5xx');
    expect(problems[0].sourceCode).toContain('example.test. IN AAAA ');
  });

  it('is not applicable without both address families', async () => {
    restore = installDns({
      'example.test': { AAAA: { data: ['2001:db8::1'] } },
    });
    serve(null, { status: 200, body: 'x' });
    expect(await runHint(hint)).toEqual([]);
  });
});
