import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/emailpolicy/mta-sts.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';
import {
  fakeDns,
  installFakes,
  type FakeAnswer,
} from '../../lib/email/fakes.js';

const POLICY_PATH = '/.well-known/mta-sts.txt';

const goodPolicy = [
  'version: STSv1',
  'mode: enforce',
  'mx: mx.example.test',
  'max_age: 604800',
].join('\r\n');

/**
 * Runs the hint with a fake DNS zone and the policy file served from the local
 * test server. The `policyUrl` option points the fetch at that server's path,
 * so the hint reaches the local server instead of the real `mta-sts` host.
 */
const run = async (
  txt: Record<string, FakeAnswer>,
  routes: Routes = {},
): Promise<Awaited<ReturnType<typeof runHint>>> => {
  const restore = installFakes({
    dns: fakeDns({ 'example.test MX': ['10 mx.example.test.'], ...txt }),
  });
  try {
    return await runHint(hint, routes, {
      hintOptions: { domain: 'example.test', policyUrl: POLICY_PATH },
    });
  } finally {
    restore();
  }
};

const policyRoute = (body: string, contentType = 'text/plain'): Routes => ({
  [POLICY_PATH]: { headers: { 'content-type': contentType }, body },
});

describe('mta-sts', () => {
  it('passes a valid TXT record and policy', async () => {
    const problems = await run(
      { '_mta-sts.example.test TXT': ['"v=STSv1; id=20240101000000"'] },
      policyRoute(goodPolicy),
    );
    expect(problems).toEqual([]);
  });

  it('warns when neither the record nor the policy exist', async () => {
    const problems = await run({ '_mta-sts.example.test TXT': [] });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('does *not* enable MTA-STS');
  });

  it('reports a record whose policy file is missing', async () => {
    const problems = await run({
      '_mta-sts.example.test TXT': ['"v=STSv1; id=20240101000000"'],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      'policy file at the `mta-sts` host is *missing*',
    );
  });

  it('reports an invalid policy mode', async () => {
    const body = goodPolicy.replace('mode: enforce', 'mode: on');
    const problems = await run(
      { '_mta-sts.example.test TXT': ['"v=STSv1; id=a1"'] },
      policyRoute(body),
    );
    expect(problems.map((p) => p.message).join(' ')).toContain(
      '`mode` must be `enforce`, `testing` or `none`',
    );
  });

  it('warns when the policy is in testing mode', async () => {
    const body = goodPolicy.replace('mode: enforce', 'mode: testing');
    const problems = await run(
      { '_mta-sts.example.test TXT': ['"v=STSv1; id=a1"'] },
      policyRoute(body),
    );
    const testing = problems.find((p) => p.message.includes('`testing` mode'));
    expect(testing?.severity).toBe(Severity.warning);
  });

  it('is silent when the domain has no MX', async () => {
    const problems = await run(
      {
        'example.test MX': [],
        '_mta-sts.example.test TXT': ['"v=STSv1; id=a1"'],
      },
      policyRoute(goodPolicy),
    );
    expect(problems).toEqual([]);
  });
});
