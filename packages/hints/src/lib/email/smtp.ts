import { isIP, type Socket } from '#net';
import {
  checkServerIdentity,
  connect,
  type ConnectionOptions,
  type DetailedPeerCertificate,
  type TLSSocket,
} from '#tls';

/** Opens a TCP connection; replaced in tests to reach a local server. */
export type ConnectFn = (host: string, port: number, family?: 4 | 6) => Socket;

/** What a STARTTLS probe of one mail server found. */
export interface StarttlsProbe {
  /** True when a TCP connection was made and the server greeted us. */
  reachable: boolean;
  /** True when the server offers (and accepted) STARTTLS. */
  starttls: boolean;
  /** The negotiated protocol, for example `TLSv1.3`. */
  tlsVersion: string | null;
  /** True when the certificate chain is complete and signed by a trusted CA. */
  trusted: boolean;
  /** Why the chain is not trusted, as OpenSSL or Node name it. */
  trustError: string | null;
  /** True when the certificate matches the mail server's host name. */
  hostnameMatches: boolean;
  /** The presented chain, leaf first, DER encoded. */
  certificates: Buffer[];
  /** Why the probe failed before TLS, when it did. */
  error: string | null;
}

export interface ProbeOptions {
  port?: number;
  /** How long to wait for each step, in milliseconds. */
  timeoutMs?: number;
  /** The name sent in EHLO. */
  ehloName?: string;
  connect: ConnectFn;
  /** Extra options for the TLS handshake, for example `ca`. */
  tlsOptions?: ConnectionOptions;
}

interface Reply {
  code: number;
  lines: string[];
}

/** Reads SMTP replies (RFC 5321 section 4.2) from a socket. */
class ReplyReader {
  private buffer = '';
  private closed: Error | null = null;
  private waiting: {
    resolve(reply: Reply): void;
    reject(error: Error): void;
  } | null = null;

  private readonly onData = (chunk: Buffer): void => {
    this.buffer += chunk.toString('latin1');
    this.flush();
  };

  public constructor(private readonly socket: Socket) {
    socket.on('data', this.onData);
    // Errors surface through `reply`; this keeps late ones from being thrown.
    socket.on('error', (error) => this.fail(error));
    socket.on('close', () => this.fail(new Error('connection closed')));
  }

  /** Stops listening, before the socket is handed over to TLS. */
  public detach(): void {
    this.socket.off('data', this.onData);
  }

  private fail(error: Error): void {
    this.closed ??= error;
    if (this.waiting) {
      const { reject } = this.waiting;
      this.waiting = null;
      reject(error);
    }
  }

  private flush(): void {
    if (!this.waiting) {
      return;
    }
    const lines = this.buffer.split('\r\n');
    const complete: string[] = [];
    for (const [index, line] of lines.entries()) {
      // The last element is an unfinished line.
      if (index === lines.length - 1) {
        break;
      }
      complete.push(line);
      // `250 text` or `250` ends a reply; `250-text` continues it.
      if (/^\d{3}(?: .*)?$/u.test(line)) {
        this.buffer = lines.slice(index + 1).join('\r\n');
        const { resolve } = this.waiting;
        this.waiting = null;
        resolve({ code: Number(line.slice(0, 3)), lines: complete });
        return;
      }
    }
  }

  public reply(timeoutMs: number): Promise<Reply> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting = null;
        reject(new Error('timed out'));
      }, timeoutMs);
      this.waiting = {
        resolve: (reply) => {
          clearTimeout(timer);
          resolve(reply);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      if (this.closed) {
        this.fail(this.closed);
      } else {
        this.flush();
      }
    });
  }
}

/** Waits for a socket event, failing on `error` or after a timeout. */
function waitFor(
  socket: Socket,
  event: 'connect' | 'secureConnect',
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('timed out'));
    }, timeoutMs);
    const onEvent = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const cleanup = (): void => {
      clearTimeout(timer);
      socket.off(event, onEvent);
      socket.off('error', onError);
    };
    socket.once(event, onEvent);
    socket.once('error', onError);
  });
}

const failed = (error: unknown): StarttlsProbe => ({
  reachable: false,
  starttls: false,
  tlsVersion: null,
  trusted: false,
  trustError: null,
  hostnameMatches: false,
  certificates: [],
  error: error instanceof Error ? error.message : String(error),
});

/** Collects the presented chain, leaf first, without looping on self-signed roots. */
function chainOf(socket: TLSSocket): Buffer[] {
  const chain: Buffer[] = [];
  const seen = new Set<Buffer>();
  let current: DetailedPeerCertificate | undefined =
    socket.getPeerCertificate(true);
  while (current?.raw && !seen.has(current.raw)) {
    seen.add(current.raw);
    chain.push(current.raw);
    current = current.issuerCertificate;
  }
  return chain;
}

/** How the SMTP dialog towards STARTTLS is run. */
export interface NegotiateOptions {
  /** How long to wait for each step, in milliseconds. */
  timeoutMs: number;
  /** The name sent in EHLO. */
  ehloName?: string;
}

/**
 * Runs the SMTP dialog of RFC 3207 on a socket that was just created: waits
 * for the connection and the greeting, says EHLO, checks the extensions for
 * STARTTLS and issues it. Resolves true when the server is ready for the TLS
 * handshake, which the caller then runs on the same socket, and false when
 * STARTTLS is not offered or refused. Rejects when the connection fails, the
 * greeting is not 220 or a step times out.
 */
export async function negotiateStarttls(
  socket: Socket,
  options: NegotiateOptions,
): Promise<boolean> {
  const reader = new ReplyReader(socket);
  await waitFor(socket, 'connect', options.timeoutMs);
  const greeting = await reader.reply(options.timeoutMs);
  if (greeting.code !== 220) {
    throw new Error(`unexpected greeting ${greeting.code}`);
  }

  socket.write(`EHLO ${options.ehloName ?? 'localhost'}\r\n`);
  const ehlo = await reader.reply(options.timeoutMs);
  const offered =
    ehlo.code === 250 &&
    ehlo.lines.some((line) => /^250[- ]STARTTLS$/iu.test(line));
  if (!offered) {
    socket.write('QUIT\r\n');
    return false;
  }

  socket.write('STARTTLS\r\n');
  const go = await reader.reply(options.timeoutMs);
  if (go.code !== 220) {
    return false;
  }
  // Stop reading plain text; the TLS layer takes over the socket.
  reader.detach();
  return true;
}

/**
 * Talks SMTP to a mail server on port 25, as Internet.nl's STARTTLS scan
 * does: read the greeting, say EHLO, check the extensions for STARTTLS, issue
 * it and run a TLS handshake without verifying the chain (the verdict is
 * reported instead of enforced) so the negotiated version, the certificate
 * chain and its validity can be inspected.
 */
export async function probeStarttls(
  host: string,
  options: ProbeOptions,
): Promise<StarttlsProbe> {
  const timeout = options.timeoutMs ?? 10_000;
  const socket = options.connect(host, options.port ?? 25);
  const done = (): void => {
    socket.destroy();
  };

  try {
    const ready = await negotiateStarttls(socket, {
      timeoutMs: timeout,
      ehloName: options.ehloName,
    });
    const base: StarttlsProbe = {
      ...failed(null),
      reachable: true,
      error: null,
    };
    if (!ready) {
      done();
      return base;
    }

    const secure = connect({
      ...options.tlsOptions,
      socket,
      // An IP address is not a valid server name.
      servername: isIP(host) === 0 ? host : undefined,
      // Never abort: the chain is judged afterwards.
      rejectUnauthorized: false,
    });
    secure.on('error', () => undefined);
    await waitFor(secure, 'secureConnect', timeout);

    const leaf = secure.getPeerCertificate();
    // Node reports the verification error as a code, or leaves it undefined.
    const rawAuthorizationError: unknown = secure.authorizationError;
    const authorizationError =
      rawAuthorizationError === undefined
        ? null
        : String(rawAuthorizationError);
    // Node folds the host name check into `authorized`; tell the two apart.
    const nameMismatch = authorizationError === 'ERR_TLS_CERT_ALTNAME_INVALID';
    const result: StarttlsProbe = {
      reachable: true,
      starttls: true,
      tlsVersion: secure.getProtocol(),
      trusted: secure.authorized || nameMismatch,
      trustError: secure.authorized || nameMismatch ? null : authorizationError,
      hostnameMatches:
        !nameMismatch && checkServerIdentity(host, leaf) === undefined,
      certificates: chainOf(secure),
      error: null,
    };
    secure.destroy();
    done();
    return result;
  } catch (error) {
    done();
    return failed(error);
  }
}

/** Classifies a TLS version the way Internet.nl's version test does. */
export function tlsVersionLevel(
  version: string | null,
): 'good' | 'sufficient' | 'insufficient' {
  if (version === 'TLSv1.3') {
    return 'good';
  }
  if (version === 'TLSv1.2') {
    return 'sufficient';
  }
  return 'insufficient';
}
