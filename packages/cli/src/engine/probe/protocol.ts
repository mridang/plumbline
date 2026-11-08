/**
 * @packageDocumentation
 *
 * The probe's wire format, version 1 (the spec is `probe/README.md`). A request
 * is `key=value` lines; an answer is JSON. Everything an answer carries is
 * checked here, so a probe that answers nonsense is an error with a name and
 * never a half-filled result handed on to a check.
 */

/** A probe that failed, refused, timed out or answered something that is not the protocol. */
export class ProbeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ProbeError';
  }
}

/**
 * The probe itself is not there to ask: it could not be reached, was too busy to answer, or
 * answered with a status that is not part of the protocol. A scan that meets one has not
 * learned anything about the site, so it must be tried again, not recorded.
 */
export class ProbeUnavailable extends ProbeError {
  public constructor(message: string) {
    super(message);
    this.name = 'ProbeUnavailable';
  }
}

/** One value of a request: a number, text, a flag, or a repeated key. */
export type Field = string | number | boolean | readonly string[] | undefined;

/** The lines of a request. `false` and `undefined` leave a key out; `true` is `1`. */
export function encodeItem(fields: Readonly<Record<string, Field>>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === false) {
      continue;
    }
    for (const one of Array.isArray(value)
      ? (value as readonly string[])
      : [value]) {
      const text = one === true ? '1' : String(one);
      if (/[\r\n]/.test(text)) {
        throw new ProbeError(`${key} holds a line break`);
      }
      lines.push(`${key}=${text}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/** The items of a batch, joined the way the probe splits them. */
export function encodeBatch(items: readonly string[]): string {
  return items.join('--\n');
}

/** The certificate facts of a handshake, named as Node names them. */
export interface RemoteCertificate {
  readonly subject: Readonly<Record<string, string>>;
  readonly issuer: Readonly<Record<string, string>>;
  readonly subjectaltname: string;
  readonly valid_from: string;
  readonly valid_to: string;
  readonly serialNumber: string;
  readonly fingerprint256: string;
  readonly keyType: string;
  readonly bits?: number;
  readonly asn1Curve?: string;
  readonly signatureAlgorithm: string;
  /** Where the issuer's certificate and an OCSP answer can be had, named as Node names them. */
  readonly infoAccess?: Readonly<Record<string, readonly string[]>>;
}

/** The key exchange of a handshake. */
export type RemoteEphemeral =
  | { readonly type: 'DH'; readonly size: number }
  | { readonly type: 'ECDH'; readonly size: number; readonly name: string };

/** What a handshake showed. */
export interface HandshakeAnswer {
  readonly protocol: string;
  readonly cipher: { readonly name: string; readonly standardName: string };
  readonly authorized: boolean;
  readonly authorizationError: string | null;
  readonly ephemeral: RemoteEphemeral | null;
  /** DER, base64, leaf first. */
  readonly chain: readonly string[];
  readonly certificates: readonly RemoteCertificate[];
  /** DER, base64. */
  readonly ocsp: string | null;
  readonly compression: boolean;
}

/** One header line of a response. */
export type HeaderPair = readonly [name: string, value: string];

/** One HTTP exchange, as the wire showed it. */
export interface HttpAnswer {
  readonly httpVersion: string;
  readonly status: number;
  readonly statusText: string;
  readonly headers: readonly HeaderPair[];
  /** The bytes as sent (chunking and content coding are not undone). */
  readonly body: Uint8Array;
  readonly truncated: boolean;
}

/** What the SMTP STARTTLS dialog and the handshake after it showed. */
export interface StarttlsAnswer {
  readonly reachable: boolean;
  readonly starttls: boolean;
  readonly tlsVersion: string | null;
  readonly trusted: boolean;
  readonly trustError: string | null;
  readonly hostnameMatches: boolean;
  /** DER, base64, leaf first. */
  readonly certificates: readonly string[];
  readonly error: string | null;
}

/** What `openssl s_client` printed. */
export interface OpensslAnswer {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number | null;
  /** The file the run wrote that the caller asked for, by name, base64. */
  readonly files: Readonly<Record<string, string>>;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, what: string): string {
  if (typeof value !== 'string') {
    throw new ProbeError(`the probe's ${what} is not text`);
  }
  return value;
}

function textOrNull(value: unknown, what: string): string | null {
  return value === null || value === undefined ? null : text(value, what);
}

function flag(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ProbeError(`the probe's ${what} is not true or false`);
  }
  return value;
}

function whole(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ProbeError(`the probe's ${what} is not a number`);
  }
  return value;
}

function listOfText(value: unknown, what: string): string[] {
  if (!Array.isArray(value)) {
    throw new ProbeError(`the probe's ${what} is not a list`);
  }
  return value.map((entry) => text(entry, what));
}

/** The bytes in base64 text. */
export function fromBase64(value: string): Uint8Array {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

/** The text as base64 (the text is read as Latin-1, byte for byte). */
export function toBase64(value: string): string {
  return btoa(value);
}

/** The object in the JSON `body`, or an error that names the probe's own complaint. */
export function parseBody(body: string): Json {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new ProbeError('the probe answered something that is not JSON');
  }
  if (!isObject(value)) {
    throw new ProbeError('the probe answered something that is not an object');
  }
  if (typeof value['error'] === 'string') {
    throw new ProbeError(value['error']);
  }
  return value;
}

function certificateOf(value: unknown): RemoteCertificate {
  if (!isObject(value)) {
    throw new ProbeError("the probe's certificate is not an object");
  }
  const names = (entry: unknown, what: string): Record<string, string> => {
    if (!isObject(entry)) {
      throw new ProbeError(`the probe's ${what} is not an object`);
    }
    return Object.fromEntries(
      Object.entries(entry).map(([k, v]) => [k, text(v, what)]),
    );
  };
  return {
    subject: names(value['subject'], 'certificate subject'),
    issuer: names(value['issuer'], 'certificate issuer'),
    subjectaltname: text(value['subjectaltname'], 'certificate names'),
    valid_from: text(value['valid_from'], 'certificate start'),
    valid_to: text(value['valid_to'], 'certificate end'),
    serialNumber: text(value['serialNumber'], 'certificate serial'),
    fingerprint256: text(value['fingerprint256'], 'certificate fingerprint'),
    keyType: text(value['keyType'], 'certificate key type'),
    ...(typeof value['bits'] === 'number' ? { bits: value['bits'] } : {}),
    ...(typeof value['asn1Curve'] === 'string'
      ? { asn1Curve: value['asn1Curve'] }
      : {}),
    signatureAlgorithm: text(
      value['signatureAlgorithm'],
      'certificate signature',
    ),
    ...(isObject(value['infoAccess'])
      ? {
          infoAccess: Object.fromEntries(
            Object.entries(value['infoAccess']).map(([k, v]) => [
              k,
              listOfText(v, 'certificate access'),
            ]),
          ),
        }
      : {}),
  };
}

function ephemeralOf(value: unknown): RemoteEphemeral | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isObject(value)) {
    throw new ProbeError("the probe's key exchange is not an object");
  }
  const size = whole(value['size'], 'key exchange size');
  return value['type'] === 'DH'
    ? { type: 'DH', size }
    : {
        type: 'ECDH',
        size,
        name: text(value['name'], 'key exchange curve'),
      };
}

/** A handshake answer, checked. */
export function parseHandshake(value: unknown): HandshakeAnswer {
  if (!isObject(value)) {
    throw new ProbeError('the probe answered something that is not an object');
  }
  if (typeof value['error'] === 'string') {
    throw new ProbeError(value['error']);
  }
  const cipher = value['cipher'];
  if (!isObject(cipher)) {
    throw new ProbeError("the probe's cipher is not an object");
  }
  const certificates = value['certificates'];
  if (!Array.isArray(certificates)) {
    throw new ProbeError("the probe's certificates are not a list");
  }
  return {
    protocol: text(value['protocol'], 'protocol'),
    cipher: {
      name: text(cipher['name'], 'cipher name'),
      standardName: text(cipher['standardName'], 'cipher standard name'),
    },
    authorized: flag(value['authorized'], 'authorized'),
    authorizationError: textOrNull(
      value['authorizationError'],
      'authorization error',
    ),
    ephemeral: ephemeralOf(value['ephemeral']),
    chain: listOfText(value['chain'], 'chain'),
    certificates: certificates.map(certificateOf),
    ocsp: textOrNull(value['ocsp'], 'OCSP response'),
    compression: value['compression'] === true,
  };
}

/** The entries of a batch answer: each is a handshake or the probe's complaint about it. */
export function parseBatch(body: string): (HandshakeAnswer | ProbeError)[] {
  const value = parseBody(body);
  const results = value['results'];
  if (!Array.isArray(results)) {
    throw new ProbeError("the probe's results are not a list");
  }
  return results.map((entry): HandshakeAnswer | ProbeError => {
    try {
      return parseHandshake(entry);
    } catch (error) {
      return error instanceof ProbeError
        ? error
        : new ProbeError(String(error));
    }
  });
}

/** An HTTP answer, checked. */
export function parseHttp(body: string): HttpAnswer {
  const value = parseBody(body);
  const headers = value['headers'];
  if (!Array.isArray(headers)) {
    throw new ProbeError("the probe's headers are not a list");
  }
  return {
    httpVersion: text(value['httpVersion'], 'HTTP version'),
    status: whole(value['status'], 'status'),
    statusText: text(value['statusText'], 'status text'),
    headers: headers.map((pair): HeaderPair => {
      if (!Array.isArray(pair) || pair.length !== 2) {
        throw new ProbeError("the probe's header is not a pair");
      }
      return [text(pair[0], 'header name'), text(pair[1], 'header value')];
    }),
    body: fromBase64(text(value['body'], 'body')),
    truncated: value['truncated'] === true,
  };
}

/** A STARTTLS answer, checked. */
export function parseStarttls(body: string): StarttlsAnswer {
  const value = parseBody(body);
  return {
    reachable: flag(value['reachable'], 'reachable'),
    starttls: flag(value['starttls'], 'STARTTLS'),
    tlsVersion: textOrNull(value['tlsVersion'], 'TLS version'),
    trusted: flag(value['trusted'], 'trusted'),
    trustError: textOrNull(value['trustError'], 'trust error'),
    hostnameMatches: flag(value['hostnameMatches'], 'host name match'),
    certificates: listOfText(value['certificates'], 'certificates'),
    error: textOrNull(value['error'], 'error'),
  };
}

/** A connection test answer, checked. */
export function parseReachable(body: string): boolean {
  return flag(parseBody(body)['reachable'], 'reachable');
}

/** An `openssl` answer, checked. */
export function parseOpenssl(body: string): OpensslAnswer {
  const value = parseBody(body);
  const files = value['files'];
  return {
    stdout: new TextDecoder().decode(
      fromBase64(text(value['stdout'], 'stdout')),
    ),
    stderr: new TextDecoder().decode(
      fromBase64(text(value['stderr'], 'stderr')),
    ),
    code: typeof value['code'] === 'number' ? value['code'] : null,
    files: isObject(files)
      ? Object.fromEntries(
          Object.entries(files).map(([k, v]) => [k, text(v, 'file')]),
        )
      : {},
  };
}
