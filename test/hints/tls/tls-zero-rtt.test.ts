import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/tls-zero-rtt.js';
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

describe('tls-zero-rtt', () => {
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

  it('does not apply without TLS 1.3', async () => {
    missingOpenssl();
    expect(await scan({ maxVersion: 'TLSv1.2' })).toEqual([]);
  });

  it('says so when it cannot connect at all', async () => {
    const server = await startServer();
    pointAt(server.port);
    await server.close();
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('passes when early data is refused', async () => {
    fakeOpenssl('Early data was rejected');
    expect(await scan()).toEqual([]);
  });

  it('reports accepted early data', async () => {
    fakeOpenssl('Early data was accepted');
    const problems = await scan();
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toBe(
      'Your web server supports 0-RTT, which is *not* secure.',
    );
  });

  realIt('passes against a real server', async () => {
    expect(await scan()).toEqual([]);
  });
});
