import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/tls-kex-params.js';
import { runHint } from '../../helpers/run-hint.js';
import {
  fixture,
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

describe('tls-kex-params', () => {
  it('belongs to the internetnl and tls groups', () => {
    expect(hint.groups).toEqual(expect.arrayContaining(['internetnl', 'tls']));
  });

  it('passes with good curves only', async () => {
    expect(await scan({ ecdhCurve: 'X25519:prime256v1:secp384r1' })).toEqual(
      [],
    );
  });

  it('warns about a curve to be phased out', async () => {
    const problems = await scan({ ecdhCurve: 'prime256v1:secp224r1' });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('ECDH-secp224r1');
    expect(problems[0].sourceCode).toContain('ECDH-secp224r1');
  });

  it('reports an insufficient curve', async () => {
    const problems = await scan({ ecdhCurve: 'prime256v1:secp256k1' });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain('ECDH-secp256k1');
    expect(problems[0].sourceCode).toContain('ECDH-secp256k1');
  });

  it('reports finite field Diffie-Hellman with a small group', async () => {
    const problems = await scan({
      maxVersion: 'TLSv1.2',
      ciphers: 'DHE-RSA-AES128-GCM-SHA256',
      dhparam: await fixture('dh2048.pem'),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain('DH-2048');
    expect(problems[0].sourceCode).toContain('DH-2048');
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
