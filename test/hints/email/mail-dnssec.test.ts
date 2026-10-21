import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/email/mail-dnssec.js';
import { fakeDns, runMailHint } from '../../lib/email/fakes.js';

const MX = { 'example.test MX': ['10 mx.example.test.'] };
const SIGNED = { authenticated: true, data: ['ns. admin. 1 2 3 4 5'] };

describe('mail-dnssec', () => {
  it('passes when the domain and the mail servers are signed', async () => {
    const dns = fakeDns({
      ...MX,
      'example.test SOA': SIGNED,
      'mx.example.test SOA': SIGNED,
    });
    expect(await runMailHint(hint, { dns })).toEqual([]);
  });

  it('reports an unsigned domain', async () => {
    const dns = fakeDns({ ...MX, 'mx.example.test SOA': SIGNED });
    const problems = await runMailHint(hint, { dns });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('is insecure');
    expect(problems[0].message).toContain('email address domain');
  });

  it('reports an unsigned mail server domain', async () => {
    const dns = fakeDns({ ...MX, 'example.test SOA': SIGNED });
    const problems = await runMailHint(hint, { dns });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('mail server domains is insecure');
    expect(problems[0].sourceCode).toContain('mx.example.test');
  });

  it('reports a bogus domain', async () => {
    const dns = fakeDns({
      ...MX,
      'example.test SOA': { status: 2 },
      'mx.example.test SOA': SIGNED,
    });
    const problems = await runMailHint(hint, { dns });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("email address domain is 'bogus'");
  });

  it('reports a bogus mail server domain', async () => {
    const dns = fakeDns({
      ...MX,
      'example.test SOA': SIGNED,
      'mx.example.test SOA': { status: 2 },
    });
    const problems = await runMailHint(hint, { dns });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("mail server domains is 'bogus'");
  });

  it('is silent without MX records', async () => {
    expect(await runMailHint(hint, { dns: fakeDns({}) })).toEqual([]);
  });
});
