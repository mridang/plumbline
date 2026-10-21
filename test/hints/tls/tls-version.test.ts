import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/tls-version.js';
import { runHint } from '../../helpers/run-hint.js';
import {
  pointAt,
  restoreProbe,
  startServer,
} from '../../lib/tls/local-server.js';

afterEach(restoreProbe);

describe('tls-version', () => {
  it('belongs to the internetnl and tls groups', () => {
    expect(hint.groups).toEqual(expect.arrayContaining(['internetnl', 'tls']));
  });

  it('passes when only TLS 1.2 and 1.3 are accepted', async () => {
    const server = await startServer({ minVersion: 'TLSv1.2' });
    pointAt(server.port);
    const problems = await runHint(hint, {});
    await server.close();
    expect(problems).toEqual([]);
  });

  it('reports insufficiently secure versions', async () => {
    const server = await startServer();
    pointAt(server.port);
    const problems = await runHint(hint, {});
    await server.close();
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      '*insufficiently* secure TLS versions',
    );
    expect(problems[0].message).toContain('TLS 1.1, TLS 1.0');
  });

  it('says so when it cannot connect', async () => {
    const server = await startServer();
    pointAt(server.port);
    await server.close();
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain('Could not test');
  });
});
