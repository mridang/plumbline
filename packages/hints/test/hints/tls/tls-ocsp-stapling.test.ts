import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/tls-ocsp-stapling.js';
import { runHint } from '../../helpers/run-hint.js';
import {
  OCSP_STAPLE,
  pointAt,
  restoreProbe,
  startServer,
} from '../../lib/tls/local-server.js';

afterEach(restoreProbe);

/** Scans a local server with the certificate, stapling or not. */
async function scan(cert: string, staple: boolean) {
  const server = await startServer({ cert });
  if (staple) {
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- OCSPRequest event API passes a node-style callback that cannot be awaited
    server.server.on('OCSPRequest', (_cert, _issuer, callback) =>
      // eslint-disable-next-line promise/prefer-await-to-callbacks -- OCSPRequest event API passes a node-style callback that cannot be awaited
      callback(null, OCSP_STAPLE),
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
    expect(problems[0].sourceCode).toContain('OCSP - URI: ');
    expect(problems[0].sourceCode).toContain('Stapled OCSP response: none');
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
