import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/https-available.js';
import { runHint } from '../../helpers/run-hint.js';
import {
  pointAt,
  restoreProbe,
  startServer,
} from '../../lib/tls/local-server.js';

afterEach(restoreProbe);

describe('https-available', () => {
  it('belongs to the internetnl and tls groups', () => {
    expect(hint.groups).toEqual(expect.arrayContaining(['internetnl', 'tls']));
  });

  it('passes when the server completes a TLS handshake', async () => {
    const server = await startServer();
    pointAt(server.port);
    const problems = await runHint(hint, {});
    await server.close();
    expect(problems).toEqual([]);
  });

  it('does not judge the certificate', async () => {
    const server = await startServer();
    pointAt(server.port, false);
    const problems = await runHint(hint, {});
    await server.close();
    expect(problems).toEqual([]);
  });

  it('reports a site that does not offer HTTPS', async () => {
    const server = await startServer();
    pointAt(server.port);
    const { port } = server;
    await server.close();
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toBe(
      'Your website does *not* offer HTTPS: no TLS connection could be made.',
    );
    expect(problems[0].sourceCode).toBe(
      `127.0.0.1:${port} refused the connection or did not complete a TLS handshake`,
    );
  });
});
