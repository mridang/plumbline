import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/caa.js';
import { installDns, type Zone } from '../../lib/network/fake-dns.js';
import { runHint } from '../../helpers/run-hint.js';

let restore: () => void = () => undefined;
afterEach(() => restore());
const run = (zone: Zone) => {
  restore = installDns(zone);
  return runHint(hint);
};
const caa = (...data: string[]) => ({ 'example.test': { CAA: { data } } });

describe('caa', () => {
  it('passes with a valid CAA that has an issue property', async () => {
    expect(await run(caa('0 issue "letsencrypt.org"'))).toEqual([]);
  });

  it('finds CAA on a parent domain', async () => {
    restore = installDns(caa('0 issue "letsencrypt.org"'), 'www.example.test');
    expect(await runHint(hint)).toEqual([]);
  });

  it('warns when the domain has no CAA', async () => {
    const problems = await run({});
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toBe('Your domain does not have CAA.');
    expect(problems[0].sourceCode).toBe(
      'example.test. IN CAA 0 issue "ca.example.net"',
    );
  });

  it('warns about a syntax error', async () => {
    const problems = await run(caa('0 issue "ca.test"', '0 iodef "ftp://x"'));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('invalid CAA');
    expect(problems[0].message).toContain('iodef');
    expect(problems[0].sourceCode).toBe(
      'example.test. IN CAA 0 issue "ca.test"\nexample.test. IN CAA 0 iodef "ftp://x"',
    );
  });

  it('warns about a missing issue property', async () => {
    const problems = await run(caa('0 iodef "mailto:a@example.org"'));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('insufficiently protective');
    expect(problems[0].sourceCode).toContain(
      'example.test. IN CAA 0 iodef "mailto:a@example.org"',
    );
    expect(problems[0].sourceCode).toContain('IN CAA 0 issue "ca.example.net"');
  });
});
