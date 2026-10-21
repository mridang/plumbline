import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from '@jest/globals';
import {
  countRenegotiations,
  execOpenssl,
  openssl,
  parseCanCompress,
  parseCompression,
  parseEarlyData,
  parseExtendedMasterSecret,
  parseSecureRenegotiation,
  testClientRenegotiation,
  testCompression,
  testExtendedMasterSecret,
  testSecureRenegotiation,
  testZeroRtt,
  type OpensslExec,
  type OpensslRun,
} from '../../../src/lib/tls/openssl.js';
import { startServer } from './local-server.js';

afterEach(() => {
  openssl.exec = execOpenssl;
  openssl.command = 'openssl';
});

/** The tests that run the real binary need openssl on the PATH. */
const hasOpenssl = spawnSync('openssl', ['version']).status === 0;
const realIt = hasOpenssl ? it : it.skip;

const target = { host: '127.0.0.1', port: 4433 };

/** Makes `openssl.exec` return the output and records the arguments. */
function fake(stdout: string, stderr = ''): string[][] {
  const calls: string[][] = [];
  const exec: OpensslExec = (args) => {
    calls.push([...args]);
    return Promise.resolve({ stdout, stderr, code: 0 } as OpensslRun);
  };
  openssl.exec = exec;
  return calls;
}

/** Makes `openssl.exec` fail the way a missing or broken binary does. */
function failWith(code: string | undefined): void {
  openssl.exec = () =>
    Promise.reject(Object.assign(new Error('spawn openssl'), { code }));
}

describe('parsers', () => {
  it('reads secure renegotiation', () => {
    expect(parseSecureRenegotiation('Secure Renegotiation IS supported')).toBe(
      'supported',
    );
    expect(
      parseSecureRenegotiation('Secure Renegotiation IS NOT supported'),
    ).toBe('not-supported');
    expect(parseSecureRenegotiation('nothing')).toBeNull();
  });

  it('reads the compression method', () => {
    expect(parseCompression('x\nCompression: NONE\ny')).toBe('none');
    expect(parseCompression('Compression: zlib\n')).toBe('zlib');
    expect(parseCompression('no handshake')).toBeNull();
  });

  it('knows whether openssl offered compression', () => {
    const none = 'compression_methods (len=1)\n        No Compression (0x00)\n';
    const zlib =
      'compression_methods (len=2)\n        zlib compression (0x01)\n';
    expect(parseCanCompress(none)).toBe(false);
    expect(parseCanCompress(zlib)).toBe(true);
    expect(parseCanCompress('')).toBe(false);
  });

  it('reads the extended master secret', () => {
    expect(parseExtendedMasterSecret('Extended master secret: yes')).toBe(true);
    expect(parseExtendedMasterSecret('Extended master secret: no')).toBe(false);
    expect(parseExtendedMasterSecret('')).toBeNull();
  });

  it('reads the early data outcome', () => {
    expect(parseEarlyData('Early data was accepted')).toBe(true);
    expect(parseEarlyData('Early data was rejected')).toBe(false);
    expect(parseEarlyData('Early data was not sent')).toBe(false);
    expect(parseEarlyData('Reused, TLSv1.3')).toBeNull();
  });

  it('counts completed renegotiations', () => {
    const done =
      'RENEGOTIATING\nSSL_connect:SSL negotiation finished successfully\n';
    const refused = 'RENEGOTIATING\nread:errno=0\n';
    expect(countRenegotiations(`${done}${done}${refused}`)).toBe(2);
    expect(countRenegotiations('no commands')).toBe(0);
  });
});

describe('probes with a fake openssl', () => {
  it('reports a missing binary as unavailable', async () => {
    failWith('ENOENT');
    const probes = [
      testCompression,
      testSecureRenegotiation,
      testClientRenegotiation,
      testExtendedMasterSecret,
      testZeroRtt,
    ];
    for (const probe of probes) {
      expect(await probe(target)).toEqual({ kind: 'unavailable' });
    }
  });

  it('reports another failure to run as failed', async () => {
    failWith(undefined);
    const outcome = await testCompression(target);
    expect(outcome.kind).toBe('failed');
  });

  it('connects with a server name for host names only', async () => {
    const calls = fake('Secure Renegotiation IS supported');
    await testSecureRenegotiation({ host: 'example.test', port: 443 });
    await testSecureRenegotiation({ host: '::1', port: 443 });
    await testSecureRenegotiation(target);
    expect(calls[0]).toEqual([
      's_client',
      '-connect',
      'example.test:443',
      '-servername',
      'example.test',
      '-tls1_2',
    ]);
    expect(calls[1]).toEqual(['s_client', '-connect', '[::1]:443', '-tls1_2']);
    expect(calls[2]).toEqual([
      's_client',
      '-connect',
      '127.0.0.1:4433',
      '-tls1_2',
    ]);
  });

  it('finds compression', async () => {
    fake('Compression: zlib\n', 'compression_methods (len=2)\n');
    expect(await testCompression(target)).toMatchObject({
      kind: 'ok',
      value: 'compressed',
    });
    const outcome = await testCompression(target);
    expect(outcome.kind === 'ok' ? outcome.evidence : '').toBe(
      '$ openssl s_client -connect 127.0.0.1:4433 -tls1_2 -comp -trace\nCompression: zlib',
    );
  });

  it('finds no compression', async () => {
    fake('Compression: NONE\n', 'compression_methods (len=2)\n');
    expect(await testCompression(target)).toMatchObject({
      kind: 'ok',
      value: 'none',
    });
  });

  it('knows when openssl cannot offer compression', async () => {
    fake('Compression: NONE\ncompression_methods (len=1)\n');
    expect(await testCompression(target)).toMatchObject({
      kind: 'ok',
      value: 'cannot-compress',
    });
  });

  it('fails the compression test without a handshake', async () => {
    fake('connect:errno=61');
    expect((await testCompression(target)).kind).toBe('failed');
  });

  it('finds missing secure renegotiation', async () => {
    fake('Secure Renegotiation IS NOT supported');
    expect(await testSecureRenegotiation(target)).toMatchObject({
      kind: 'ok',
      value: 'not-supported',
    });
    const outcome = await testSecureRenegotiation(target);
    expect(outcome.kind === 'ok' ? outcome.evidence : '').toBe(
      '$ openssl s_client -connect 127.0.0.1:4433 -tls1_2\nSecure Renegotiation IS NOT supported',
    );
  });

  it('fails the secure renegotiation test without a handshake', async () => {
    fake('');
    expect((await testSecureRenegotiation(target)).kind).toBe('failed');
  });

  it('counts accepted client renegotiations', async () => {
    const done =
      'RENEGOTIATING\nSSL_connect:SSL negotiation finished successfully\n';
    const calls = fake(`Secure Renegotiation IS supported\n${done.repeat(11)}`);
    expect(await testClientRenegotiation(target)).toMatchObject({
      kind: 'ok',
      value: 11,
    });
    expect(calls[0]).toContain('-state');
    const outcome = await testClientRenegotiation(target);
    expect(outcome.kind === 'ok' ? outcome.evidence : '').toContain(
      'client renegotiations completed: 11',
    );
  });

  it('fails the client renegotiation test without a handshake', async () => {
    fake('');
    expect((await testClientRenegotiation(target)).kind).toBe('failed');
  });

  it('finds a missing extended master secret', async () => {
    fake('Extended master secret: no');
    expect(await testExtendedMasterSecret(target)).toMatchObject({
      kind: 'ok',
      value: 'not-supported',
    });
    const outcome = await testExtendedMasterSecret(target);
    expect(outcome.kind === 'ok' ? outcome.evidence : '').toContain(
      'Extended master secret: no',
    );
  });

  it('finds a supported extended master secret', async () => {
    fake('Extended master secret: yes');
    expect(await testExtendedMasterSecret(target)).toMatchObject({
      kind: 'ok',
      value: 'supported',
    });
  });

  it('fails the EMS test without a handshake', async () => {
    fake('');
    expect((await testExtendedMasterSecret(target)).kind).toBe('failed');
  });

  it('finds accepted early data', async () => {
    const calls = fake('Early data was accepted');
    expect(await testZeroRtt(target)).toMatchObject({
      kind: 'ok',
      value: true,
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('-sess_out');
    expect(calls[1]).toContain('-sess_in');
    expect(calls[1]).toContain('-early_data');
    const outcome = await testZeroRtt(target);
    expect(outcome.kind === 'ok' ? outcome.evidence : '').toContain(
      'Early data was accepted',
    );
  });

  it('finds refused early data', async () => {
    fake('Early data was rejected');
    expect(await testZeroRtt(target)).toMatchObject({
      kind: 'ok',
      value: false,
    });
  });

  it('fails the 0-RTT test when the session cannot be resumed', async () => {
    fake('no resumption');
    expect((await testZeroRtt(target)).kind).toBe('failed');
  });

  it('stops the 0-RTT test when the second run cannot start', async () => {
    let runs = 0;
    openssl.exec = () => {
      runs += 1;
      return runs === 1
        ? Promise.resolve({ stdout: '', stderr: '', code: 0 })
        : Promise.reject(Object.assign(new Error('gone'), { code: 'ENOENT' }));
    };
    expect(await testZeroRtt(target)).toEqual({ kind: 'unavailable' });
  });
});

describe('execOpenssl', () => {
  realIt('runs the binary and feeds standard input', async () => {
    const run = await execOpenssl(['enc', '-base64'], { input: ['hi\n'] });
    expect(run.code).toBe(0);
    expect(run.stdout.trim()).toBe('aGkK');
  });

  realIt('kills a process that takes too long', async () => {
    const run = await execOpenssl(['enc', '-base64'], {
      input: ['a\n', 'b\n'],
      inputDelayMs: 2000,
      timeoutMs: 100,
    });
    expect(run.code).toBeNull();
  });

  it('rejects when the binary cannot be started', async () => {
    openssl.command = '/nonexistent/openssl';
    await expect(execOpenssl(['version'])).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

describe('probes with the real openssl against a local server', () => {
  realIt(
    'finds secure renegotiation and the extended master secret',
    async () => {
      const server = await startServer({
        keepOpen: true,
        minVersion: 'TLSv1.2',
      });
      const at = { host: '127.0.0.1', port: server.port };
      const secure = await testSecureRenegotiation(at);
      const ems = await testExtendedMasterSecret(at);
      await server.close();
      expect(secure).toMatchObject({ kind: 'ok', value: 'supported' });
      expect(ems).toMatchObject({ kind: 'ok', value: 'supported' });
    },
  );

  realIt('finds no compression', async () => {
    const server = await startServer({ keepOpen: true, minVersion: 'TLSv1.2' });
    const outcome = await testCompression({
      host: '127.0.0.1',
      port: server.port,
    });
    await server.close();
    // Without zlib in this openssl the probe cannot tell; both are fine.
    expect(['none', 'cannot-compress']).toContain(
      outcome.kind === 'ok' ? outcome.value : outcome.kind,
    );
  });

  realIt('finds that early data is not accepted', async () => {
    const server = await startServer({ keepOpen: true });
    const outcome = await testZeroRtt({ host: '127.0.0.1', port: server.port });
    await server.close();
    expect(outcome).toMatchObject({ kind: 'ok', value: false });
  });

  realIt(
    'counts the renegotiations the server accepts',
    async () => {
      const server = await startServer({
        keepOpen: true,
        minVersion: 'TLSv1.2',
      });
      const outcome = await testClientRenegotiation({
        host: '127.0.0.1',
        port: server.port,
      });
      await server.close();
      expect(outcome.kind).toBe('ok');
      expect(outcome.kind === 'ok' ? outcome.value : 0).toBeGreaterThan(0);
    },
    30000,
  );

  realIt('fails when nothing listens', async () => {
    const server = await startServer({ keepOpen: true });
    const port = server.port;
    await server.close();
    const outcome = await testSecureRenegotiation({ host: '127.0.0.1', port });
    expect(outcome.kind).toBe('failed');
  });
});
