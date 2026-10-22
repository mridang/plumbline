import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/cert-hostname.js';
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

describe('cert-hostname', () => {
  it('belongs to the internetnl and tls groups', () => {
    expect(hint.groups).toEqual(expect.arrayContaining(['internetnl', 'tls']));
  });

  it('passes when the host is on the certificate', async () => {
    expect(await scan('rsa3072')).toEqual([]);
  });

  it('reports a certificate for another name', async () => {
    const problems = await scan('rsa3072-othername');
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain('does *not* match');
    expect(problems[0].message).toContain('DNS:other.example.test');
    expect(problems[0].sourceCode).toContain('Requested host: 127.0.0.1');
    expect(problems[0].sourceCode).toContain('DNS:other.example.test');
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
