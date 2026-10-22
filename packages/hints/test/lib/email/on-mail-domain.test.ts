import { afterEach, describe, expect, it } from '@jest/globals';
import { Category, defineHint } from '../../../src/core/define-hint.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../../src/lib/email/on-mail-domain.js';
import { runHint } from '../../helpers/run-hint.js';
import { fakeDns, installFakes } from './fakes.js';

/** A hint that reports the domain and hosts it was handed. */
const probe = defineHint({
  id: 'test-mail-domain',
  name: 'Test',
  description: 'Reports what onMailDomain hands over.',
  category: Category.other,
  groups: ['email'],
  schema: [
    {
      type: 'object',
      additionalProperties: false,
      properties: DOMAIN_OPTION_SCHEMA,
    },
  ],
  setup(context) {
    onMailDomain(context, (mail) => {
      mail.report(`${mail.domain}: ${mail.hosts.join(',')}`);
      return Promise.resolve();
    });
  },
});

let restore = (): void => undefined;
afterEach(() => restore());

describe('onMailDomain', () => {
  it('uses the configured domain and its MX hosts', async () => {
    restore = installFakes({
      dns: fakeDns({
        'example.test MX': ['20 b.example.test.', '10 a.example.test.'],
      }),
    });
    const problems = await runHint(
      probe,
      {},
      { hintOptions: { domain: 'Example.test.' } },
    );
    expect(problems.map((p) => p.message)).toEqual([
      'example.test: a.example.test,b.example.test',
    ]);
  });

  it('does nothing when the domain has no MX records', async () => {
    restore = installFakes({ dns: fakeDns({}) });
    expect(
      await runHint(probe, {}, { hintOptions: { domain: 'example.test' } }),
    ).toEqual([]);
  });

  it('does nothing when the domain has a Null MX', async () => {
    restore = installFakes({ dns: fakeDns({ 'example.test MX': ['0 .'] }) });
    expect(
      await runHint(probe, {}, { hintOptions: { domain: 'example.test' } }),
    ).toEqual([]);
  });

  it('does nothing for a site without a registrable domain', async () => {
    // The scanned host is 127.0.0.1; the fake would answer for any name.
    restore = installFakes({
      dns: { query: () => Promise.reject(new Error('must not be queried')) },
    });
    expect(await runHint(probe, {})).toEqual([]);
  });
});
