import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import { tlsProbe } from '../../../src/lib/tls/client.js';
import { defineMailTlsHint } from '../../../src/hints/email/on-mail-tls.js';
import { MAIL_SUBJECT } from '../../../src/hints/tls/on-tls-site.js';
import { fakeDns, runMailHint } from '../../lib/email/fakes.js';
import { restoreProbe } from '../../lib/tls/local-server.js';

afterEach(restoreProbe);

/** What the check of the hint under test was called with. */
interface Call {
  host: string;
  port: number;
  starttls: string | undefined;
  subject: unknown;
}

/** A hint whose check records its target and reports through every helper. */
function recorder(calls: Call[]) {
  return defineMailTlsHint({
    id: 'mail-tls-recorder',
    name: 'Recorder',
    description: 'Records the targets of a mail TLS check.',
    check: ({ target, subject, report, couldNotTest }) => {
      calls.push({
        host: target.host,
        port: target.port,
        starttls: target.starttls,
        subject,
      });
      report('A rule failed.', 'evidence');
      report('Some advice.', 'more evidence', Severity.warning);
      couldNotTest('no luck');
    },
  });
}

const dns = fakeDns({
  'example.test MX': ['20 mx2.example.test.', '10 mx1.example.test.'],
});

describe('defineMailTlsHint', () => {
  it('runs the check once per mail server over STARTTLS on the mail port', async () => {
    const calls: Call[] = [];
    tlsProbe.mailPort = 2525;
    await runMailHint(recorder(calls), { dns });
    expect(calls).toEqual([
      {
        host: 'mx1.example.test',
        port: 2525,
        starttls: 'smtp',
        subject: MAIL_SUBJECT,
      },
      {
        host: 'mx2.example.test',
        port: 2525,
        starttls: 'smtp',
        subject: MAIL_SUBJECT,
      },
    ]);
  });

  it('tests the mail servers at once, and still reports them in the order of the servers', async () => {
    let running = 0;
    let most = 0;
    const slowFirst = defineMailTlsHint({
      id: 'mail-tls-slow-first',
      name: 'Slow first',
      description: 'Takes longer for the first server.',
      check: async ({ target, report }) => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) =>
          setTimeout(resolve, target.host === 'mx1.example.test' ? 30 : 1),
        );
        running -= 1;
        report(`checked ${target.host}`, 'evidence');
      },
    });
    const problems = await runMailHint(slowFirst, { dns });
    expect(most).toBe(2);
    expect(problems.map((p) => p.message)).toEqual([
      'mx1.example.test: checked mx1.example.test',
      'mx2.example.test: checked mx2.example.test',
    ]);
  });

  it('reports per mail server with the evidence as code snippet', async () => {
    const problems = await runMailHint(recorder([]), { dns });
    expect(problems.map((p) => [p.message, p.severity, p.sourceCode])).toEqual([
      ['mx1.example.test: A rule failed.', Severity.error, 'evidence'],
      ['mx1.example.test: Some advice.', Severity.warning, 'more evidence'],
      [
        'mx1.example.test: Could not test: no luck.',
        Severity.hint,
        'mx1.example.test:25',
      ],
      ['mx2.example.test: A rule failed.', Severity.error, 'evidence'],
      ['mx2.example.test: Some advice.', Severity.warning, 'more evidence'],
      [
        'mx2.example.test: Could not test: no luck.',
        Severity.hint,
        'mx2.example.test:25',
      ],
    ]);
  });

  it('checks the domain of the domain option', async () => {
    const calls: Call[] = [];
    await runMailHint(
      recorder(calls),
      { dns: fakeDns({ 'other.test MX': ['10 mail.other.test.'] }) },
      { domain: 'other.test' },
    );
    expect(calls.map((call) => call.host)).toEqual(['mail.other.test']);
  });

  it('stays silent when the domain has no MX records', async () => {
    const calls: Call[] = [];
    expect(await runMailHint(recorder(calls), { dns: fakeDns({}) })).toEqual(
      [],
    );
    expect(calls).toEqual([]);
  });

  it('stays silent for a Null MX', async () => {
    const calls: Call[] = [];
    await runMailHint(recorder(calls), {
      dns: fakeDns({ 'example.test MX': ['0 .'] }),
    });
    expect(calls).toEqual([]);
  });

  it('puts the hint in the internetnl, email and tls groups', () => {
    expect(recorder([]).groups).toEqual(['internetnl', 'email', 'tls']);
  });
});
