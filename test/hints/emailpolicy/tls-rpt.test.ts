import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/emailpolicy/tls-rpt.js';
import {
  fakeDns,
  runMailHint,
  type FakeAnswer,
} from '../../lib/email/fakes.js';

const run = (txt: Record<string, FakeAnswer>) =>
  runMailHint(hint, {
    dns: fakeDns({ 'example.test MX': ['10 mx.example.test.'], ...txt }),
  });

describe('tls-rpt', () => {
  it('passes a valid record', async () => {
    expect(
      await run({
        '_smtp._tls.example.test TXT': [
          '"v=TLSRPTv1; rua=mailto:tls@example.test"',
        ],
      }),
    ).toEqual([]);
  });

  it('warns when no record is published', async () => {
    const problems = await run({ '_smtp._tls.example.test TXT': [] });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain(
      'does *not* publish a TLS-RPT record',
    );
  });

  it('reports a record without a destination', async () => {
    const problems = await run({
      '_smtp._tls.example.test TXT': ['"v=TLSRPTv1"'],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain('*no* `rua` destination');
  });

  it('reports an insecure destination', async () => {
    const problems = await run({
      '_smtp._tls.example.test TXT': [
        '"v=TLSRPTv1; rua=http://insecure.test/r"',
      ],
    });
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].sourceCode).toBe('rua=http://insecure.test/r');
  });

  it('is silent when the domain has no MX', async () => {
    expect(
      await runMailHint(hint, {
        dns: fakeDns({ '_smtp._tls.example.test TXT': [] }),
      }),
    ).toEqual([]);
  });
});
