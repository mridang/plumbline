import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/cert-signature.js';
import { runHint } from '../../helpers/run-hint.js';
import {
  pointAt,
  restoreProbe,
  startServer,
} from '../../lib/tls/local-server.js';

afterEach(restoreProbe);

/** Scans a local server presenting the certificate. */
async function scan(cert: string) {
  const server = await startServer({ cert });
  pointAt(server.port);
  const problems = await runHint(hint, {});
  await server.close();
  return problems;
}

describe('cert-signature', () => {
  it('belongs to the internetnl and tls groups', () => {
    expect(hint.groups).toEqual(expect.arrayContaining(['internetnl', 'tls']));
  });

  it.each(['rsa3072', 'rsa-signed'])('passes for %s', async (cert) => {
    expect(await scan(cert)).toEqual([]);
  });

  it('warns about SHA-224', async () => {
    const problems = await scan('rsa3072-sha224');
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('localhost: ecdsa-with-SHA224');
    expect(problems[0].sourceCode).toContain('Subject: CN=localhost');
    expect(problems[0].sourceCode).toContain('Issuer: CN=');
    expect(problems[0].sourceCode).toContain('Public key: ');
    expect(problems[0].sourceCode).toContain(
      'Signature algorithm: ecdsa-with-SHA224',
    );
  });

  it('reports SHA-1', async () => {
    const problems = await scan('rsa3072-sha1');
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      '*insufficiently* secure signing algorithm',
    );
    expect(problems[0].message).toContain('localhost: ecdsa-with-SHA1');
    expect(problems[0].sourceCode).toContain(
      'Signature algorithm: ecdsa-with-SHA1',
    );
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
