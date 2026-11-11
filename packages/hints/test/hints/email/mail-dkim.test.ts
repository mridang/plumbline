import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-dkim.js';
import {
  fakeDns,
  runMailHint,
  type FakeAnswer,
} from '../../lib/email/fakes.js';

// eslint-disable-next-line n/no-sync -- sync is fine in a script or bootstrap: the key is generated once at module load
const KEY = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .publicKey.export({ type: 'spki', format: 'der' })
  .toString('base64');

const run = (txt: Record<string, FakeAnswer>, selectors?: string[]) =>
  runMailHint(
    hint,
    { dns: fakeDns({ 'example.test MX': ['10 mx.example.test.'], ...txt }) },
    selectors ? { selectors } : {},
  );

describe('mail-dkim', () => {
  it('explains that selectors are needed when none are configured', async () => {
    const problems = await run({});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain('without their selectors');
    expect(problems[0].sourceCode).toContain(
      '<selector>._domainkey.example.test. IN TXT',
    );
  });

  it('treats an empty selector list as not configured', async () => {
    const problems = await run({}, ['', '  ']);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('passes valid records', async () => {
    const problems = await run(
      {
        's1._domainkey.example.test TXT': [`"v=DKIM1; k=rsa; p=${KEY}"`],
        's2._domainkey.example.test TXT': [`"p=${KEY}"`],
      },
      ['s1', 's2'],
    );
    expect(problems).toEqual([]);
  });

  it('reports a selector without a record', async () => {
    const problems = await run({}, ['gone']);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("no DKIM record for selector 'gone'");
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].sourceCode).toBe('gone._domainkey.example.test');
  });

  it('reports a lookup that failed', async () => {
    const problems = await run(
      { 's1._domainkey.example.test TXT': { status: 2 } },
      ['s1'],
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('could not be looked up');
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('reports an invalid record', async () => {
    const problems = await run(
      { 's1._domainkey.example.test TXT': ['"v=DKIM1; k=rsa"'] },
      ['s1'],
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('is not valid');
    expect(problems[0].message).toContain("'p' tag is missing");
    expect(problems[0].sourceCode).toBe('v=DKIM1; k=rsa');
  });

  it('reports a revoked key', async () => {
    const problems = await run(
      { 's1._domainkey.example.test TXT': ['"v=DKIM1; p="'] },
      ['s1'],
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('revoked');
  });

  it('reports several records for one selector', async () => {
    const problems = await run(
      { 's1._domainkey.example.test TXT': [`"p=${KEY}"`, `"p=${KEY}"`] },
      ['s1'],
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('ambiguous');
  });

  it('warns about testing mode', async () => {
    const problems = await run(
      { 's1._domainkey.example.test TXT': [`"t=y; p=${KEY}"`] },
      ['s1'],
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('is silent without MX records', async () => {
    expect(
      await runMailHint(hint, { dns: fakeDns({}) }, { selectors: ['s1'] }),
    ).toEqual([]);
  });
});
