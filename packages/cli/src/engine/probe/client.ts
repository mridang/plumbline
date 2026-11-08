/**
 * @packageDocumentation
 *
 * The probe as the engine uses it: one method for each thing the probe does,
 * over a transport that carries a request body to a path and brings back the
 * status and text of the answer. The transport is the only part that knows how
 * the probe is reached (a container's port in a Worker, a local server in a
 * test), so tests and the live service differ by one function.
 *
 * Handshakes are asked for in batches: a scan makes hundreds of them, one
 * round trip each would take minutes, and the probe runs a batch's handshakes
 * at the same time.
 */

import {
  ProbeError,
  ProbeUnavailable,
  encodeBatch,
  encodeItem,
  parseBatch,
  parseBody,
  parseHandshake,
  parseHttp,
  parseOpenssl,
  parseReachable,
  parseStarttls,
  type Field,
  type HandshakeAnswer,
  type HttpAnswer,
  type OpensslAnswer,
  type StarttlsAnswer,
} from './protocol.js';

/** Sends `body` to `path` of the probe and gives back the status and the text of the answer. */
export type ProbeTransport = (
  path: string,
  body: string,
) => Promise<{ readonly status: number; readonly text: string }>;

/** What a handshake is asked to do (see `probe/README.md`). */
export interface HandshakeRequest {
  readonly host: string;
  readonly port: number;
  readonly starttls?: 'smtp';
  readonly min?: string;
  readonly max?: string;
  readonly ciphers?: string;
  readonly sigalgs?: string;
  readonly curves?: string;
  readonly ocsp?: boolean;
}

/** What an HTTP exchange is asked to do. */
export interface HttpRequest {
  readonly host: string;
  readonly port: number;
  readonly tls: boolean;
  /** Connect here, and send `host` as the name. */
  readonly ip?: string;
  readonly method: string;
  readonly path: string;
  readonly headers: readonly (readonly [name: string, value: string])[];
  /** Stop after the headers. */
  readonly nobody?: boolean;
  readonly maxBody?: number;
}

/** What an `openssl s_client` run is asked to do. */
export interface OpensslRequest {
  readonly host: string;
  readonly port: number;
  readonly servername?: string;
  readonly starttls?: 'smtp';
  /** Flags from the short list the probe allows. */
  readonly flags: readonly string[];
  /** A name for the session this run saves, or resumes. */
  readonly sessionOut?: string;
  readonly sessionIn?: string;
  /** Early data for a resumed session, as text (Latin-1). */
  readonly earlyData?: string;
  /** Lines written to standard input, one every `delayMs`. */
  readonly input: readonly string[];
  readonly delayMs: number;
  readonly timeoutMs: number;
}

/** How a batch of handshakes is gathered. */
export interface BatchOptions {
  /** The most handshakes in one request. */
  readonly size?: number;
  /** How long to wait for more before sending what there is, in milliseconds. */
  readonly waitMs?: number;
  /** The most web requests on their way to the probe at once (it serves a few at a time). */
  readonly inFlight?: number;
  /** The most mail requests on their way at once; a mail server may take seconds to answer. */
  readonly mailInFlight?: number;
  /** How many times a request is sent again when the probe says it is busy. */
  readonly retries?: number;
}

/**
 * Web requests and mail requests are kept apart: a mail server may take many seconds to
 * answer (it holds its greeting back, or tars a connection it does not like), and a web
 * request or a batch of handshakes must not wait behind it.
 */
type Lane = 'web' | 'mail';

/** The requests of a lane on their way, and those waiting for a place. */
interface Pool {
  readonly limit: number;
  active: number;
  readonly queue: (() => void)[];
}

/** One handshake waiting to be sent, with the way to answer it. */
interface Waiting {
  readonly request: string;
  readonly resolve: (answer: HandshakeAnswer) => void;
  readonly reject: (error: ProbeError) => void;
}

/** The text as Latin-1 bytes in base64 (the lines a program is fed are bytes). */
function lineBase64(value: string): string {
  return btoa(value);
}

/** A probe, reached through a transport. */
export class ProbeClient {
  private readonly size: number;
  private readonly waitMs: number;
  private readonly retries: number;
  private readonly lanes: Record<Lane, Pool>;
  private readonly waiting: Record<Lane, Waiting[]> = { web: [], mail: [] };
  private readonly timers: Record<
    Lane,
    ReturnType<typeof setTimeout> | undefined
  > = {
    web: undefined,
    mail: undefined,
  };

  public constructor(
    private readonly transport: ProbeTransport,
    options: BatchOptions = {},
  ) {
    this.size = options.size ?? 64;
    this.waitMs = options.waitMs ?? 5;
    this.retries = options.retries ?? 40;
    this.lanes = {
      web: { limit: options.inFlight ?? 20, active: 0, queue: [] },
      mail: { limit: options.mailInFlight ?? 6, active: 0, queue: [] },
    };
  }

  /** Waits for a place among the requests of its lane on their way, and gives it back when `work` is done. */
  private async turn<T>(lane: Lane, work: () => Promise<T>): Promise<T> {
    const pool = this.lanes[lane];
    if (pool.active >= pool.limit) {
      await new Promise<void>((resolve) => pool.queue.push(resolve));
    }
    pool.active += 1;
    try {
      return await work();
    } finally {
      pool.active -= 1;
      pool.queue.shift()?.();
    }
  }

  /** Sends a request and gives back the text of a 200 answer; anything else is a {@link ProbeError}. */
  private async send(
    path: string,
    body: string,
    lane: Lane = 'web',
  ): Promise<string> {
    return this.turn(lane, async () => {
      for (let attempt = 0; ; attempt += 1) {
        let answer;
        try {
          answer = await this.transport(path, body);
        } catch (error) {
          throw new ProbeUnavailable(
            `the probe could not be reached: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        if (answer.status === 503 && attempt < this.retries) {
          // The probe serves a few requests at a time; wait for a place.
          await new Promise((resolve) =>
            setTimeout(resolve, 50 + 25 * Math.min(attempt, 12)),
          );
          continue;
        }
        return this.checked(answer);
      }
    });
  }

  /** The text of a 200 answer; a 502 is the probe's own complaint, anything else an error. */
  private checked(answer: {
    readonly status: number;
    readonly text: string;
  }): string {
    if (answer.status === 502) {
      // The probe's own complaint about this request (it could not connect, it was refused).
      throw new ProbeError(parseComplaint(answer.text));
    }
    if (answer.status !== 200) {
      throw new ProbeUnavailable(
        `the probe answered ${answer.status}${answer.status === 503 ? ' (it is busy)' : ''}`,
      );
    }
    return answer.text;
  }

  /** One handshake. It rejects with a {@link ProbeError} when the server would not complete one. */
  public handshake(request: HandshakeRequest): Promise<HandshakeAnswer> {
    const item = encodeItem({
      host: request.host,
      port: request.port,
      starttls: request.starttls,
      min: request.min,
      max: request.max,
      ciphers: request.ciphers,
      sigalgs: request.sigalgs,
      curves: request.curves,
      ocsp: request.ocsp,
    });
    const lane: Lane = request.starttls ? 'mail' : 'web';
    return new Promise((resolve, reject) => {
      this.waiting[lane].push({ request: item, resolve, reject });
      if (this.waiting[lane].length >= this.size) {
        void this.flush(lane);
      } else if (this.timers[lane] === undefined) {
        this.timers[lane] = setTimeout(
          () => void this.flush(lane),
          this.waitMs,
        );
      }
    });
  }

  /** Sends the handshakes waiting in a lane, as one request, and answers each. */
  private async flush(lane: Lane): Promise<void> {
    const timer = this.timers[lane];
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers[lane] = undefined;
    }
    const batch = this.waiting[lane].splice(0, this.size);
    if (batch.length === 0) {
      return;
    }
    try {
      const text = await this.send(
        '/v1/handshakes',
        encodeBatch(batch.map((entry) => entry.request)),
        lane,
      );
      const answers = parseBatch(text);
      if (answers.length !== batch.length) {
        throw new ProbeError(
          `the probe answered ${answers.length} handshakes for ${batch.length}`,
        );
      }
      batch.forEach((entry, index) => {
        const answer = answers[index];
        if (answer instanceof ProbeError) {
          entry.reject(answer);
        } else if (answer) {
          entry.resolve(answer);
        }
      });
    } catch (error) {
      const failure =
        error instanceof ProbeError ? error : new ProbeError(String(error));
      for (const entry of batch) {
        entry.reject(failure);
      }
    }
    if (this.waiting[lane].length > 0) {
      void this.flush(lane);
    }
  }

  /** One handshake, asked for alone (no waiting for company). */
  public async handshakeNow(
    request: HandshakeRequest,
  ): Promise<HandshakeAnswer> {
    const text = await this.send(
      '/handshake',
      encodeItem({
        host: request.host,
        port: request.port,
        starttls: request.starttls,
        min: request.min,
        max: request.max,
        ciphers: request.ciphers,
        sigalgs: request.sigalgs,
        curves: request.curves,
        ocsp: request.ocsp,
      }),
    );
    return parseHandshake(parseBody(text));
  }

  /** The SMTP STARTTLS dialog of a mail server on port 25. */
  public async starttls(host: string): Promise<StarttlsAnswer> {
    return parseStarttls(
      await this.send('/v1/starttls', encodeItem({ host }), 'mail'),
    );
  }

  /** Whether a TCP connection to `host` (a name or an address) on `port` succeeds. */
  public async reachable(
    host: string,
    port: number,
    timeoutMs?: number,
  ): Promise<boolean> {
    try {
      return parseReachable(
        await this.send(
          '/v1/connect',
          encodeItem({ host, port, timeout: timeoutMs }),
          port === 25 ? 'mail' : 'web',
        ),
      );
    } catch (error) {
      if (
        error instanceof ProbeError &&
        /public address|resolve/.test(error.message)
      ) {
        return false;
      }
      throw error;
    }
  }

  /** One HTTP exchange, headers and body exactly as they came. */
  public async http(request: HttpRequest): Promise<HttpAnswer> {
    const fields: Record<string, Field> = {
      host: request.host,
      port: request.port,
      tls: request.tls,
      ip: request.ip,
      method: request.method,
      path: request.path,
      header: request.headers.map(([name, value]) => `${name}: ${value}`),
      nobody: request.nobody,
      maxbody: request.maxBody,
    };
    return parseHttp(await this.send('/v1/http', encodeItem(fields)));
  }

  /** The trusted roots the probe judges chains against, as one PEM bundle. */
  public async roots(): Promise<string> {
    return this.send('/v1/roots', '');
  }

  /** One `openssl s_client` run. */
  public async openssl(request: OpensslRequest): Promise<OpensslAnswer> {
    const fields: Record<string, Field> = {
      host: request.host,
      port: request.port,
      servername: request.servername,
      starttls: request.starttls,
      flag: request.flags,
      sess_out: request.sessionOut,
      sess_in: request.sessionIn,
      early_data:
        request.earlyData === undefined
          ? undefined
          : lineBase64(request.earlyData),
      input: request.input.map(lineBase64),
      delay: request.delayMs,
      timeout: request.timeoutMs,
    };
    return parseOpenssl(
      await this.send(
        '/v1/openssl',
        encodeItem(fields),
        request.port === 25 ? 'mail' : 'web',
      ),
    );
  }
}

/** The complaint in a 502 answer: `{"error": "..."}`, or whatever else the body says. */
function parseComplaint(body: string): string {
  try {
    const value = JSON.parse(body) as { error?: unknown };
    if (typeof value.error === 'string') {
      return value.error;
    }
  } catch {
    // Not JSON: fall through to the body itself.
  }
  return body.slice(0, 200) || 'the probe failed';
}
