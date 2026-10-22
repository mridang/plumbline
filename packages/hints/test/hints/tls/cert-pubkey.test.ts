import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/cert-pubkey.js';
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

describe('cert-pubkey', () => {
  it('belongs to the internetnl and tls groups', () => {
    expect(hint.groups).toEqual(expect.arrayContaining(['internetnl', 'tls']));
  });

  it.each(['rsa3072', 'ec256', 'ed25519'])('passes for %s', async (cert) => {
    expect(await scan(cert)).toEqual([]);
  });

  it.each([
    ['rsa2048', 'RSA-2048'],
    ['ec-secp224', 'EC, curve: secp224r1'],
  ])('warns about %s', async (cert, description) => {
    const problems = await scan(cert);
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('*phased out*');
    expect(problems[0].message).toContain(`localhost: ${description}`);
    expect(problems[0].sourceCode).toContain('Subject: CN=localhost');
    expect(problems[0].sourceCode).toContain(`Public key: ${description}`);
  });

  it.each([
    ['rsa1024', 'RSA-1024'],
    ['ec-secp256k1', 'EC, curve: secp256k1'],
  ])('reports %s', async (cert, description) => {
    const problems = await scan(cert);
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      '*not* based on a secure signing algorithm',
    );
    expect(problems[0].message).toContain(`localhost: ${description}`);
    expect(problems[0].sourceCode).toContain('Subject: CN=localhost');
    expect(problems[0].sourceCode).toContain(`Public key: ${description}`);
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
