import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/tls-kex-hash.js';
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

describe('tls-kex-hash', () => {
  it('belongs to the internetnl and tls groups', () => {
    expect(hint.groups).toEqual(expect.arrayContaining(['internetnl', 'tls']));
  });

  it('passes when the server will not sign with a weak hash', async () => {
    // The default security level refuses to sign with SHA-1 and SHA-224.
    expect(
      await scan({
        maxVersion: 'TLSv1.2',
        ciphers: 'DEFAULT',
        sigalgs: 'RSA+SHA256',
      }),
    ).toEqual([]);
  });

  it('reports a server that signs the key exchange with SHA-1', async () => {
    const problems = await scan({ maxVersion: 'TLSv1.2' });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      '*insufficiently* secure hash functions',
    );
    expect(problems[0].message).toContain('SHA1');
    expect(problems[0].sourceCode).toContain(
      'accepts only: RSA+SHA1, ECDSA+SHA1',
    );
  });

  it('warns about a server that signs with SHA-224', async () => {
    const problems = await scan({
      maxVersion: 'TLSv1.2',
      ciphers: 'DEFAULT',
      sigalgs: 'RSA+SHA224:RSA+SHA256',
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('SHA224');
    expect(problems[0].sourceCode).toContain(
      'accepts only: RSA+SHA224, ECDSA+SHA224',
    );
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
