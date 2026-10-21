import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/tls-ocsp-stapling.js';
import { runHint } from '../../helpers/run-hint.js';
import {
  pointAt,
  restoreProbe,
  startServer,
} from '../../lib/tls/local-server.js';

afterEach(restoreProbe);

/** Scans a local server with the certificate, stapling or not. */
async function scan(cert: string, staple: boolean) {
  const server = await startServer({ cert });
  if (staple) {
    server.server.on('OCSPRequest', (_cert, _issuer, callback) =>
      callback(null, Buffer.from('stapled response')),
    );
  }
  pointAt(server.port);
  const problems = await runHint(hint, {});
  await server.close();
  return problems;
}

describe('tls-ocsp-stapling', () => {
  it('belongs to the internetnl and tls groups', () => {
    expect(hint.groups).toEqual(expect.arrayContaining(['internetnl', 'tls']));
  });

  it('passes when a response is stapled', async () => {
    expect(await scan('rsa3072', true)).toEqual([]);
  });

  it('informs about a missing staple when the certificate has an OCSP pointer', async () => {
    const problems = await scan('rsa3072', false);
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain('does *not* support OCSP stapling');
  });

  it('does not apply to a certificate without an OCSP pointer', async () => {
    expect(await scan('rsa3072-noocsp', false)).toEqual([]);
  });

  it('says so when it cannot connect', async () => {
    const server = await startServer();
    pointAt(server.port);
    await server.close();
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('Could not test');
  });
});
