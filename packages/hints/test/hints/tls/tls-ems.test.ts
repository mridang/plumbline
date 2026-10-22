import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/tls-ems.js';
import { runHint } from '../../helpers/run-hint.js';
import {
  fakeOpenssl,
  missingOpenssl,
  realIt,
  restoreOpenssl,
} from '../../lib/tls/fake-openssl.js';
import {
  pointAt,
  restoreProbe,
  startServer,
  type LocalServerOptions,
} from '../../lib/tls/local-server.js';

afterEach(() => {
  restoreProbe();
  restoreOpenssl();
});

/** Scans a local server configured with the options. */
async function scan(options: LocalServerOptions = {}) {
  const server = await startServer({ keepOpen: true, ...options });
  pointAt(server.port);
  const problems = await runHint(hint, {});
  await server.close();
  return problems;
}

describe('tls-ems', () => {
  it('belongs to the internetnl and tls groups', () => {
    expect(hint.groups).toEqual(expect.arrayContaining(['internetnl', 'tls']));
  });

  it('says so when openssl is not available', async () => {
    missingOpenssl();
    const problems = await scan();
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toBe('Could not test: openssl not available.');
  });

  it('says so when the openssl probe fails', async () => {
    fakeOpenssl('no handshake');
    const problems = await scan();
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain('Could not test');
  });

  it('does not apply without TLS 1.2', async () => {
    missingOpenssl();
    expect(await scan({ minVersion: 'TLSv1.3' })).toEqual([]);
  });

  it('says so when it cannot connect at all', async () => {
    const server = await startServer();
    pointAt(server.port);
    await server.close();
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('passes when the extended master secret is used', async () => {
    fakeOpenssl('Extended master secret: yes');
    expect(await scan()).toEqual([]);
  });

  it('reports a missing extended master secret', async () => {
    fakeOpenssl('Extended master secret: no');
    const problems = await scan();
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toBe('Your web server does *not* support EMS.');
    expect(problems[0].sourceCode).toContain('Extended master secret: no');
  });

  realIt('passes against a real server', async () => {
    expect(await scan({ minVersion: 'TLSv1.2' })).toEqual([]);
  });
});
