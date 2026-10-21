import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/tls-ciphers.js';
import { runHint } from '../../helpers/run-hint.js';
import {
  pointAt,
  restoreProbe,
  startServer,
  type LocalServerOptions,
} from '../../lib/tls/local-server.js';

afterEach(restoreProbe);

/** Scans a local server configured with the options. */
async function scan(options: LocalServerOptions) {
  const server = await startServer(options);
  pointAt(server.port);
  const problems = await runHint(hint, {});
  await server.close();
  return problems;
}

describe('tls-ciphers', () => {
  it('belongs to the internetnl and tls groups', () => {
    expect(hint.groups).toEqual(expect.arrayContaining(['internetnl', 'tls']));
  });

  it('passes with sufficient and good suites only', async () => {
    expect(
      await scan({
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384',
      }),
    ).toEqual([]);
  });

  it('warns about suites to be phased out', async () => {
    const problems = await scan({
      maxVersion: 'TLSv1.2',
      ciphers: 'ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES128-GCM-SHA256',
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('*phased out*');
    expect(problems[0].message).toContain(
      'TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256',
    );
  });

  it('reports insufficiently secure suites', async () => {
    const problems = await scan({
      maxVersion: 'TLSv1.2',
      ciphers: 'AES128-SHA:ECDHE-RSA-AES128-GCM-SHA256',
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      '*insufficiently* secure cipher suites',
    );
    expect(problems[0].message).toContain('TLS_RSA_WITH_AES_128_CBC_SHA');
  });

  it('says so when it cannot connect', async () => {
    const server = await startServer();
    pointAt(server.port);
    await server.close();
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
  });
});
