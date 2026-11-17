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
import { spawn } from '#child_process';
import { isIP } from '#net';
import { mkdtemp, rm, writeFile } from '#fs/promises';
import { tmpdir } from '#os';
import { join } from '#path';
import { isObject } from '../wellknown/json.js';
import { SCAN_RENEGOTIATION_LIMIT } from './constants.js';
import type { TlsTarget } from './client.js';

/** Matches an early data evidence line. */
const EARLY_DATA_EVIDENCE_LINE = /^Early data was/iu;

/** Matches an extended master secret evidence line. */
const EXTENDED_MASTER_SECRET_EVIDENCE_LINE = /^Extended master secret:/iu;

/** Matches a secure renegotiation evidence line. */
const SECURE_RENEGOTIATION_EVIDENCE_LINE = /^Secure Renegotiation IS/iu;

/** Matches a compression evidence line. */
const COMPRESSION_EVIDENCE_LINE = /^Compression:/u;

/** Matches a rejected or unsent early data line. */
const EARLY_DATA_NOT_ACCEPTED = /Early data was (rejected|not sent)/iu;

/** Matches an accepted early data line. */
const EARLY_DATA_ACCEPTED = /Early data was accepted/iu;

/** Matches the extended master secret result. */
const EXTENDED_MASTER_SECRET_RESULT = /Extended master secret: (yes|no)/iu;

/** Matches the compression methods length in a trace. */
const COMPRESSION_METHODS_LENGTH = /compression_methods \(len=(\d+)\)/u;

/** Matches the negotiated compression line. */
const COMPRESSION_LINE = /^Compression: (\S+)/mu;

/** Matches an unsupported secure renegotiation line. */
const SECURE_RENEGOTIATION_UNSUPPORTED =
  /Secure Renegotiation IS NOT supported/iu;

/** Matches a supported secure renegotiation line. */
const SECURE_RENEGOTIATION_SUPPORTED = /Secure Renegotiation IS supported/iu;

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
export const execOpenssl: OpensslExec = async (args, options = {}) =>
  new Promise<OpensslRun>((resolve, reject) => {
    const child = spawn(openssl.command, [...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // eslint-disable-next-line functional/no-let -- accumulates the streamed output across data events
    let stdout = '';
    // eslint-disable-next-line functional/no-let -- accumulates the streamed output across data events
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    // A missing binary surfaces here as ENOENT.
    child.once('error', reject);
    child.stdin.on('error', () => undefined);
    const timer = setTimeout(
      () => child.kill('SIGKILL'),
      options.timeoutMs ?? 15_000,
    );
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    // Feed the lines slowly: s_client must finish each command first.
    const lines = options.input ?? [];
    const feed = (index: number): void => {
      if (index >= lines.length) {
        child.stdin.end();
        return;
      }
      child.stdin.write(lines[index]);
      setTimeout(() => {
        feed(index + 1);
      }, options.inputDelayMs ?? 0);
    };
    feed(0);
  });

/** The settings of {@link openssl}. */
export interface OpensslSettings {
  exec: OpensslExec;
  command: string;
}

/**
 * The `openssl` runner hints use; tests assign a fake `exec`. `command` is
 * the program `execOpenssl` starts, `openssl` from the PATH by default.
 */
export const openssl: OpensslSettings = {
  exec: execOpenssl,
  command: 'openssl',
};

/** Outcome of an openssl based probe. */
export type OpensslOutcome<T> =
  | { kind: 'unavailable' }
  | { kind: 'failed'; reason: string }
  | {
      kind: 'ok';
      value: T;

      /**
       * The `openssl` command and the lines of its output the verdict rests
       * on, ready to show as a code snippet. Empty from `runSClient`.
       */
      evidence: string;
    };

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
    // A mail server starts in plain SMTP and is upgraded by `s_client`.
    ...(target.starttls ? ['-starttls', target.starttls] : []),
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
    return { kind: 'ok', value: run, evidence: '' };
  } catch (error) {
    const code = isObject(error) ? error.code : undefined;
    return code === 'ENOENT'
      ? { kind: 'unavailable' }
      : { kind: 'failed', reason: String(error) };
  }
}

/**
 * The `openssl` command line and the lines of `output` that match `pattern`,
 * so a report can show what the verdict rests on.
 */
function opensslEvidence(
  target: TlsTarget,
  extra: readonly string[],
  output: string,
  pattern: RegExp,
): string {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => pattern.test(line));
  return [`$ openssl ${sClientArgs(target, extra).join(' ')}`, ...lines].join(
    '\n',
  );
}

/** Secure renegotiation support as `s_client` prints it (TLS 1.2 and older). */
export function parseSecureRenegotiation(
  output: string,
): 'supported' | 'not-supported' | null {
  if (SECURE_RENEGOTIATION_SUPPORTED.test(output)) {
    return 'supported';
  }
  if (SECURE_RENEGOTIATION_UNSUPPORTED.test(output)) {
    return 'not-supported';
  }
  return null;
}

/** The compression method negotiated, from the `Compression:` line. */
export function parseCompression(output: string): string | null {
  const match = COMPRESSION_LINE.exec(output);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Whether this `openssl` can offer compression at all: its ClientHello
 * (from `-trace`) lists more than the null method. Without zlib support
 * the test could never find compression.
 */
export function parseCanCompress(trace: string): boolean {
  const match = COMPRESSION_METHODS_LENGTH.exec(trace);
  return match ? Number(match[1]) > 1 : false;
}

/** Whether the Extended Master Secret was used in the session. */
export function parseExtendedMasterSecret(output: string): boolean | null {
  const match = EXTENDED_MASTER_SECRET_RESULT.exec(output);
  return match ? match[1].toLowerCase() === 'yes' : null;
}

/** Whether the server accepted 0-RTT early data on resumption. */
export function parseEarlyData(output: string): boolean | null {
  if (EARLY_DATA_ACCEPTED.test(output)) {
    return true;
  }
  // `rejected`: sent but refused. `not sent`: the server's ticket did not
  // allow early data at all, which is the best configuration.
  if (EARLY_DATA_NOT_ACCEPTED.test(output)) {
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
    .filter((part) => part.includes('SSL negotiation finished successfully'))
    .length;
}

/** Result of the compression test. */
export type CompressionResult = 'none' | 'compressed' | 'cannot-compress';

/** Tests TLS compression: offers it and sees if the server negotiates it. */
export async function testCompression(
  target: TlsTarget,
): Promise<OpensslOutcome<CompressionResult>> {
  const args = ['-tls1_2', '-comp', '-trace'];
  const outcome = await runSClient(target, args);
  if (outcome.kind !== 'ok') {
    return outcome;
  }
  const { stdout, stderr } = outcome.value;
  const output = `${stdout}\n${stderr}`;
  if (parseCompression(output) === null) {
    return { kind: 'failed', reason: 'no TLS 1.2 handshake' };
  }
  const evidence = opensslEvidence(
    target,
    args,
    output,
    COMPRESSION_EVIDENCE_LINE,
  );
  if (!parseCanCompress(output)) {
    return { kind: 'ok', value: 'cannot-compress', evidence };
  }
  return {
    kind: 'ok',
    value: parseCompression(output) === 'none' ? 'none' : 'compressed',
    evidence,
  };
}

/** Result of the secure renegotiation test. */
export type SecureRenegotiationResult = 'supported' | 'not-supported';

/** Tests RFC 5746 secure renegotiation support (TLS 1.2 handshake). */
export async function testSecureRenegotiation(
  target: TlsTarget,
): Promise<OpensslOutcome<SecureRenegotiationResult>> {
  const args = ['-tls1_2'];
  const outcome = await runSClient(target, args);
  if (outcome.kind !== 'ok') {
    return outcome;
  }
  const output = `${outcome.value.stdout}\n${outcome.value.stderr}`;
  const result = parseSecureRenegotiation(output);
  return result === null
    ? { kind: 'failed', reason: 'no TLS 1.2 handshake' }
    : {
        kind: 'ok',
        value: result,
        evidence: opensslEvidence(
          target,
          args,
          output,
          SECURE_RENEGOTIATION_EVIDENCE_LINE,
        ),
      };
}

/**
 * Tests client-initiated renegotiation: sends the `R` command to `s_client`
 * one more time than the NCSC limit (11) and counts completed handshakes.
 */
export async function testClientRenegotiation(
  target: TlsTarget,
): Promise<OpensslOutcome<number>> {
  const args = ['-tls1_2', '-state'];
  const outcome = await runSClient(target, args, {
    input: [
      ...Array.from({ length: SCAN_RENEGOTIATION_LIMIT }, () => 'R\n'),
      'Q\n',
    ],
    inputDelayMs: 300,
    timeoutMs: 30_000,
  });
  if (outcome.kind !== 'ok') {
    return outcome;
  }
  const output = `${outcome.value.stdout}\n${outcome.value.stderr}`;
  if (parseSecureRenegotiation(output) === null) {
    return { kind: 'failed', reason: 'no TLS 1.2 handshake' };
  }
  const count = countRenegotiations(output);
  return {
    kind: 'ok',
    value: count,
    evidence: `${opensslEvidence(target, args, output, SECURE_RENEGOTIATION_EVIDENCE_LINE)}\nclient renegotiations completed: ${count} (sent ${SCAN_RENEGOTIATION_LIMIT})`,
  };
}

/** Result of the Extended Master Secret test. */
export type ExtendedMasterSecretResult = 'supported' | 'not-supported';

/** Tests RFC 7627 Extended Master Secret on a TLS 1.2 handshake. */
export async function testExtendedMasterSecret(
  target: TlsTarget,
): Promise<OpensslOutcome<ExtendedMasterSecretResult>> {
  const args = ['-tls1_2'];
  const outcome = await runSClient(target, args);
  if (outcome.kind !== 'ok') {
    return outcome;
  }
  const output = `${outcome.value.stdout}\n${outcome.value.stderr}`;
  const used = parseExtendedMasterSecret(output);
  return used === null
    ? { kind: 'failed', reason: 'no TLS 1.2 handshake' }
    : {
        kind: 'ok',
        value: used ? 'supported' : 'not-supported',
        evidence: opensslEvidence(
          target,
          args,
          output,
          EXTENDED_MASTER_SECRET_EVIDENCE_LINE,
        ),
      };
}

/**
 * Tests 0-RTT: makes a TLS 1.3 connection that saves its session, then
 * resumes it sending early data and sees whether the server accepts it.
 */
export async function testZeroRtt(
  target: TlsTarget,
): Promise<OpensslOutcome<boolean>> {
  const created = await mkdtemp(join(tmpdir(), 'webhint-0rtt-'))
    .then((path) => ({ directory: path }))
    .catch((error: unknown) => ({ failure: String(error) }));
  if ('failure' in created) {
    return { kind: 'failed', reason: created.failure };
  }
  const { directory } = created;
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
    const resumeArgs = ['-tls1_3', '-sess_in', session, '-early_data', early];
    const second = await runSClient(target, resumeArgs, {
      input: ['', 'Q\n'],
      inputDelayMs: 500,
    });
    if (second.kind !== 'ok') {
      return second;
    }
    const output = `${second.value.stdout}\n${second.value.stderr}`;
    const accepted = parseEarlyData(output);
    return accepted === null
      ? { kind: 'failed', reason: 'session could not be resumed' }
      : {
          kind: 'ok',
          value: accepted,
          evidence: opensslEvidence(
            target,
            resumeArgs,
            output,
            EARLY_DATA_EVIDENCE_LINE,
          ),
        };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
