import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/tls-compression.js';
import { runHint } from '../../helpers/run-hint.js';
import {
  fakeOpenssl,
  missingOpenssl,
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

describe('tls-compression', () => {
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

  it('passes when compression is not negotiated', async () => {
    fakeOpenssl('Compression: NONE\n', 'compression_methods (len=2)\n');
    expect(await scan()).toEqual([]);
  });

  it('reports negotiated compression', async () => {
    fakeOpenssl('Compression: zlib\n', 'compression_methods (len=2)\n');
    const problems = await scan();
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toBe(
      'Your web server supports TLS compression, which is *not* secure.',
    );
    expect(problems[0].sourceCode).toContain('$ openssl s_client -connect ');
    expect(problems[0].sourceCode).toContain('Compression: zlib');
  });

  it('says so when openssl cannot offer compression', async () => {
    fakeOpenssl('Compression: NONE\n', 'compression_methods (len=1)\n');
    const problems = await scan();
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain('without TLS compression support');
  });
});
