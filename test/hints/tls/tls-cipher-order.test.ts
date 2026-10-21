import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/tls-cipher-order.js';
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

/** A phase out suite and a sufficient one. */
const MIXED = 'ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES128-GCM-SHA256';

describe('tls-cipher-order', () => {
  it('belongs to the internetnl and tls groups', () => {
    expect(hint.groups).toEqual(expect.arrayContaining(['internetnl', 'tls']));
  });

  it('passes when the server enforces its own, better, order', async () => {
    expect(
      await scan({
        maxVersion: 'TLSv1.2',
        honorCipherOrder: true,
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA256',
      }),
    ).toEqual([]);
  });

  it('reports a server that follows the client order', async () => {
    const problems = await scan({
      maxVersion: 'TLSv1.2',
      honorCipherOrder: false,
      ciphers: MIXED,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      'does *not* enforce its own preference',
    );
    expect(problems[0].message).toContain(
      'preferred TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256 instead of TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
    );
    expect(problems[0].sourceCode).toContain('Server chose: ');
    expect(problems[0].sourceCode).toContain('Should have chosen: ');
  });

  it('reports a server that prefers a worse suite of its own', async () => {
    const problems = await scan({
      maxVersion: 'TLSv1.2',
      honorCipherOrder: true,
      ciphers: MIXED,
    });
    expect(problems).toHaveLength(1);
  });

  it('does not apply when only sufficient suites are accepted', async () => {
    expect(
      await scan({
        maxVersion: 'TLSv1.2',
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256',
      }),
    ).toEqual([]);
  });

  it('does not apply to a TLS 1.3 only server', async () => {
    expect(await scan({ minVersion: 'TLSv1.3' })).toEqual([]);
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
