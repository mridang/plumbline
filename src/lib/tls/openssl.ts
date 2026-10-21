/**
 * Probes that Node's `tls` module cannot make, done with `openssl s_client`
 * when an `openssl` binary is on the PATH: TLS compression, secure and
 * client-initiated renegotiation, 0-RTT and the Extended Master Secret.
 *
 * The package never depends on `openssl`. The hints that use this file
 * report a `Severity.hint` "could not test: openssl not available" when the
 * binary is missing. Tests inject a fake `openssl.exec` and check the
 * parsers against real `s_client` output.
 */
import { spawn } from 'node:child_process';
import { isIP } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCAN_RENEGOTIATION_LIMIT } from './constants.js';
import type { TlsTarget } from './client.js';

/** What a finished `openssl` process printed. */
export interface OpensslRun {
  stdout: string;
  stderr: string;
  code: number | null;
}

/** How to run one `openssl` command. */
interface OpensslExecOptions {
  /** Lines written to standard input, one every `inputDelayMs`. */
  input?: readonly string[];
  inputDelayMs?: number;
  /** Kill the process after this long; defaults to 15 seconds. */
  timeoutMs?: number;
}

/** Runs `openssl` with the arguments; rejects when it cannot be started. */
export type OpensslExec = (
  args: readonly string[],
  options?: OpensslExecOptions,
) => Promise<OpensslRun>;

/** Runs the real `openssl` binary found on the PATH. */
export const execOpenssl: OpensslExec = (args, options = {}) =>
  new Promise<OpensslRun>((resolve, reject) => {
    const child = spawn(openssl.command, [...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    // A missing binary surfaces here as ENOENT.
    child.once('error', reject);
    child.stdin.on('error', () => undefined);
    const timer = setTimeout(
      () => child.kill('SIGKILL'),
      options.timeoutMs ?? 15000,
    );
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    // Feed the lines slowly: s_client must finish each command first.
    const lines = [...(options.input ?? [])];
    const feed = (): void => {
      const line = lines.shift();
      if (line === undefined) {
        child.stdin.end();
        return;
      }
      child.stdin.write(line);
      setTimeout(feed, options.inputDelayMs ?? 0);
    };
    feed();
  });

/**
 * The `openssl` runner hints use; tests assign a fake `exec`. `command` is
 * the program `execOpenssl` starts, `openssl` from the PATH by default.
 */
export const openssl: { exec: OpensslExec; command: string } = {
  exec: execOpenssl,
  command: 'openssl',
};

/** Outcome of an openssl based probe. */
export type OpensslOutcome<T> =
  | { kind: 'unavailable' }
  | { kind: 'failed'; reason: string }
  | { kind: 'ok'; value: T };

/** `host:port` as `s_client -connect` wants it (IPv6 in brackets). */
function connectArg(target: TlsTarget): string {
  return isIP(target.host) === 6
    ? `[${target.host}]:${target.port}`
    : `${target.host}:${target.port}`;
}

/** Arguments that make `s_client` connect to the target. */
function sClientArgs(target: TlsTarget, extra: readonly string[]): string[] {
  return [
    's_client',
    '-connect',
    connectArg(target),
    // SNI must be a name, never an IP address.
    ...(isIP(target.host) ? [] : ['-servername', target.host]),
    ...extra,
  ];
}

/**
 * Runs `s_client` and wraps a missing binary or a crash in an outcome, so
 * hints only have to handle the three kinds.
 */
async function runSClient(
  target: TlsTarget,
  extra: readonly string[],
  options: OpensslExecOptions = {},
): Promise<OpensslOutcome<OpensslRun>> {
  try {
    const run = await openssl.exec(sClientArgs(target, extra), {
      input: ['Q\n'],
      ...options,
    });
    return { kind: 'ok', value: run };
  } catch (error) {
    const code = (error as { code?: string }).code;
    return code === 'ENOENT'
      ? { kind: 'unavailable' }
      : { kind: 'failed', reason: String(error) };
  }
}

/** Secure renegotiation support as `s_client` prints it (TLS 1.2 and older). */
export function parseSecureRenegotiation(
  output: string,
): 'supported' | 'not-supported' | null {
  if (/Secure Renegotiation IS supported/i.test(output)) {
    return 'supported';
  }
  if (/Secure Renegotiation IS NOT supported/i.test(output)) {
    return 'not-supported';
  }
  return null;
}

/** The compression method negotiated, from the `Compression:` line. */
export function parseCompression(output: string): string | null {
  const match = /^Compression: (\S+)/m.exec(output);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Whether this `openssl` can offer compression at all: its ClientHello
 * (from `-trace`) lists more than the null method. Without zlib support
 * the test could never find compression.
 */
export function parseCanCompress(trace: string): boolean {
  const match = /compression_methods \(len=(\d+)\)/.exec(trace);
  return match ? Number(match[1]) > 1 : false;
}

/** Whether the Extended Master Secret was used in the session. */
export function parseExtendedMasterSecret(output: string): boolean | null {
  const match = /Extended master secret: (yes|no)/i.exec(output);
  return match ? match[1].toLowerCase() === 'yes' : null;
}

/** Whether the server accepted 0-RTT early data on resumption. */
export function parseEarlyData(output: string): boolean | null {
  if (/Early data was accepted/i.test(output)) {
    return true;
  }
  // `rejected`: sent but refused. `not sent`: the server's ticket did not
  // allow early data at all, which is the best configuration.
  if (/Early data was (rejected|not sent)/i.test(output)) {
    return false;
  }
  return null;
}

/**
 * Counts the client-initiated renegotiations a server completed, from
 * `-state` output: `s_client` prints `RENEGOTIATING` for each `R` command,
 * and the renegotiation succeeded when the handshake that follows finishes
 * before the next command.
 */
export function countRenegotiations(output: string): number {
  return output
    .split('RENEGOTIATING')
    .slice(1)
    .filter((part) => /SSL negotiation finished successfully/.test(part))
    .length;
}

/** Result of the compression test. */
export type CompressionResult = 'none' | 'compressed' | 'cannot-compress';

/** Tests TLS compression: offers it and sees if the server negotiates it. */
export async function testCompression(
  target: TlsTarget,
): Promise<OpensslOutcome<CompressionResult>> {
  const outcome = await runSClient(target, ['-tls1_2', '-comp', '-trace']);
  if (outcome.kind !== 'ok') {
    return outcome;
  }
  const { stdout, stderr } = outcome.value;
  const output = `${stdout}\n${stderr}`;
  if (parseCompression(output) === null) {
    return { kind: 'failed', reason: 'no TLS 1.2 handshake' };
  }
  if (!parseCanCompress(output)) {
    return { kind: 'ok', value: 'cannot-compress' };
  }
  return {
    kind: 'ok',
    value: parseCompression(output) === 'none' ? 'none' : 'compressed',
  };
}

/** Result of the secure renegotiation test. */
export type SecureRenegotiationResult = 'supported' | 'not-supported';

/** Tests RFC 5746 secure renegotiation support (TLS 1.2 handshake). */
export async function testSecureRenegotiation(
  target: TlsTarget,
): Promise<OpensslOutcome<SecureRenegotiationResult>> {
  const outcome = await runSClient(target, ['-tls1_2']);
  if (outcome.kind !== 'ok') {
    return outcome;
  }
  const result = parseSecureRenegotiation(
    `${outcome.value.stdout}\n${outcome.value.stderr}`,
  );
  return result === null
    ? { kind: 'failed', reason: 'no TLS 1.2 handshake' }
    : { kind: 'ok', value: result };
}

/**
 * Tests client-initiated renegotiation: sends the `R` command to `s_client`
 * one more time than the NCSC limit (11) and counts completed handshakes.
 */
export async function testClientRenegotiation(
  target: TlsTarget,
): Promise<OpensslOutcome<number>> {
  const outcome = await runSClient(target, ['-tls1_2', '-state'], {
    input: [...Array(SCAN_RENEGOTIATION_LIMIT).fill('R\n'), 'Q\n'],
    inputDelayMs: 300,
    timeoutMs: 30000,
  });
  if (outcome.kind !== 'ok') {
    return outcome;
  }
  const output = `${outcome.value.stdout}\n${outcome.value.stderr}`;
  if (parseSecureRenegotiation(output) === null) {
    return { kind: 'failed', reason: 'no TLS 1.2 handshake' };
  }
  return { kind: 'ok', value: countRenegotiations(output) };
}

/** Result of the Extended Master Secret test. */
export type ExtendedMasterSecretResult = 'supported' | 'not-supported';

/** Tests RFC 7627 Extended Master Secret on a TLS 1.2 handshake. */
export async function testExtendedMasterSecret(
  target: TlsTarget,
): Promise<OpensslOutcome<ExtendedMasterSecretResult>> {
  const outcome = await runSClient(target, ['-tls1_2']);
  if (outcome.kind !== 'ok') {
    return outcome;
  }
  const used = parseExtendedMasterSecret(
    `${outcome.value.stdout}\n${outcome.value.stderr}`,
  );
  return used === null
    ? { kind: 'failed', reason: 'no TLS 1.2 handshake' }
    : { kind: 'ok', value: used ? 'supported' : 'not-supported' };
}

/**
 * Tests 0-RTT: makes a TLS 1.3 connection that saves its session, then
 * resumes it sending early data and sees whether the server accepts it.
 */
export async function testZeroRtt(
  target: TlsTarget,
): Promise<OpensslOutcome<boolean>> {
  let directory: string;
  try {
    directory = await mkdtemp(join(tmpdir(), 'webhint-0rtt-'));
  } catch (error) {
    return { kind: 'failed', reason: String(error) };
  }
  try {
    const session = join(directory, 'session.pem');
    const early = join(directory, 'early.txt');
    await writeFile(early, 'GET / HTTP/1.0\r\n\r\n');
    // The ticket arrives after the handshake, so keep the connection open
    // briefly before quitting.
    const first = await runSClient(target, ['-tls1_3', '-sess_out', session], {
      input: ['', 'Q\n'],
      inputDelayMs: 500,
    });
    if (first.kind !== 'ok') {
      return first;
    }
    const second = await runSClient(
      target,
      ['-tls1_3', '-sess_in', session, '-early_data', early],
      { input: ['', 'Q\n'], inputDelayMs: 500 },
    );
    if (second.kind !== 'ok') {
      return second;
    }
    const accepted = parseEarlyData(
      `${second.value.stdout}\n${second.value.stderr}`,
    );
    return accepted === null
      ? { kind: 'failed', reason: 'session could not be resumed' }
      : { kind: 'ok', value: accepted };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
