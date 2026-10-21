import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/tls/cert-trust.js';
import { runHint } from '../../helpers/run-hint.js';
import {
  pointAt,
  restoreProbe,
  startServer,
} from '../../lib/tls/local-server.js';

afterEach(restoreProbe);

describe('cert-trust', () => {
  it('belongs to the internetnl and tls groups', () => {
    expect(hint.groups).toEqual(expect.arrayContaining(['internetnl', 'tls']));
  });

  it('passes when the chain leads to a trusted root', async () => {
    const server = await startServer();
    pointAt(server.port, true);
    const problems = await runHint(hint, {});
    await server.close();
    expect(problems).toEqual([]);
  });

  it('reports a certificate from an unknown authority', async () => {
    const server = await startServer();
    pointAt(server.port, false);
    const problems = await runHint(hint, {});
    await server.close();
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain('*not* complete and/or *not* signed');
    expect(problems[0].message).toContain('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
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
