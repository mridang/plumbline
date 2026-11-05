/**
 * @packageDocumentation
 *
 * One TLS handshake made by the prober container for a scan. The checks that
 * need a real TLS stack (versions, cipher suites, the certificate chain, OCSP
 * stapling, STARTTLS on a mail server) cannot run in a browser or a Worker, so
 * they ask the Worker, which asks the container (`probe/`, reached through the
 * `ProbeContainer` Durable Object).
 *
 * A request is checked here before it is passed on: HTTPS only for the host
 * the scan is of, SMTP with STARTTLS for any public host, nothing on other
 * ports, and cipher, signature algorithm and group lists made only of what
 * such lists are made of. The container checks all of it again and refuses
 * private addresses on its own as well.
 */

import { isPublicWebUrl } from '@/lib/safe-fetch';

/** The ports a probe may use: HTTPS, and mail on the SMTP port. */
export const PROBE_PORTS: readonly number[] = [443, 25];

/** The TLS versions, as Node and the checks name them. */
const VERSIONS = ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'] as const;

/** The longest OpenSSL cipher list, signature algorithm list and group list a probe may carry. */
export const MAX_CIPHERS = 1000;
export const MAX_SIGALGS = 200;
export const MAX_CURVES = 100;

/** The fields a probe may carry. */
const FIELDS: readonly string[] = [
  'host',
  'port',
  'starttls',
  'min_version',
  'max_version',
  'ciphers',
  'sigalgs',
  'ecdh_curve',
  'request_ocsp',
];

/** A probe, as the container takes it. */
export interface ProbeRequest {
  readonly host: string;
  readonly port: number;
  readonly starttls?: 'smtp';
  readonly minVersion?: string;
  readonly maxVersion?: string;
  /** An OpenSSL cipher list, as `tls.connect` takes it. */
  readonly ciphers?: string;
  /** An OpenSSL signature algorithm list, for example `RSA+SHA1`. */
  readonly sigalgs?: string;
  /** Colon separated key exchange groups, for example `prime256v1:X25519`. */
  readonly ecdhCurve?: string;
  readonly requestOCSP?: boolean;
}

/** Why a probe was refused. */
export type ProbeRefusal = { readonly ok: false; readonly errors: string[] };

/** What a cipher list, a signature algorithm list and a group list may be made of. */
const CIPHER_LIST = /^[A-Za-z0-9:+!@=_.-]+$/;
const SIGALG_LIST = /^[A-Za-z0-9:+_.-]+$/;
const CURVE_LIST = /^[A-Za-z0-9:_.-]+$/;

/** A list of at most `max` characters made of what `allowed` accepts. */
function listOf(value: unknown, allowed: RegExp, max: number): boolean {
  return (
    typeof value === 'string' && value.length <= max && allowed.test(value)
  );
}

/**
 * A probe from a JSON body, or the fields at fault. `scanHost` is the host the
 * scan is of: a probe of HTTPS may only name that host.
 */
export function parseProbeRequest(
  body: Readonly<Record<string, unknown>>,
  scanHost: string,
): { readonly ok: true; readonly value: ProbeRequest } | ProbeRefusal {
  const errors: string[] = Object.keys(body)
    .filter((name) => !FIELDS.includes(name))
    .map((name) => `${name}: is not a field of a probe`);
  const {
    host,
    port,
    starttls,
    min_version: minVersion,
    max_version: maxVersion,
    ciphers,
    sigalgs,
    ecdh_curve: ecdhCurve,
    request_ocsp: requestOCSP,
  } = body;
  if (typeof host !== 'string' || !isPublicWebUrl(`https://${host}/`)) {
    errors.push('host: must be a public host name');
  }
  if (typeof port !== 'number' || !PROBE_PORTS.includes(port)) {
    errors.push(`port: must be ${PROBE_PORTS.join(' or ')}`);
  }
  if (starttls !== undefined && starttls !== 'smtp') {
    errors.push('starttls: must be smtp');
  }
  if (starttls === 'smtp' && port !== 25) {
    errors.push('starttls: smtp is only for port 25');
  }
  if (
    starttls === undefined &&
    typeof host === 'string' &&
    host.toLowerCase() !== scanHost.toLowerCase()
  ) {
    errors.push('host: HTTPS can only be probed on the host being scanned');
  }
  for (const [name, value] of [
    ['min_version', minVersion],
    ['max_version', maxVersion],
  ] as const) {
    if (
      value !== undefined &&
      !(VERSIONS as readonly unknown[]).includes(value)
    ) {
      errors.push(`${name}: must be one of ${VERSIONS.join(', ')}`);
    }
  }
  if (ciphers !== undefined && !listOf(ciphers, CIPHER_LIST, MAX_CIPHERS)) {
    errors.push('ciphers: must be an OpenSSL cipher list');
  }
  if (sigalgs !== undefined && !listOf(sigalgs, SIGALG_LIST, MAX_SIGALGS)) {
    errors.push('sigalgs: must be an OpenSSL signature algorithm list');
  }
  if (ecdhCurve !== undefined && !listOf(ecdhCurve, CURVE_LIST, MAX_CURVES)) {
    errors.push('ecdh_curve: must be a list of key exchange groups');
  }
  if (requestOCSP !== undefined && typeof requestOCSP !== 'boolean') {
    errors.push('request_ocsp: must be true or false');
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      host: host as string,
      port: port as number,
      ...(starttls === 'smtp' ? { starttls: 'smtp' as const } : {}),
      ...(minVersion === undefined ? {} : { minVersion: minVersion as string }),
      ...(maxVersion === undefined ? {} : { maxVersion: maxVersion as string }),
      ...(ciphers === undefined ? {} : { ciphers: ciphers as string }),
      ...(sigalgs === undefined ? {} : { sigalgs: sigalgs as string }),
      ...(ecdhCurve === undefined ? {} : { ecdhCurve: ecdhCurve as string }),
      ...(requestOCSP === undefined
        ? {}
        : { requestOCSP: requestOCSP as boolean }),
    },
  };
}

/**
 * The probe as the container reads it: one `key=value` line each. Every value
 * has been checked above, so none can hold a line break.
 */
export function bodyOf(request: Readonly<ProbeRequest>): string {
  const lines: [string, string | undefined][] = [
    ['host', request.host],
    ['port', String(request.port)],
    ['starttls', request.starttls],
    ['min', request.minVersion],
    ['max', request.maxVersion],
    ['ciphers', request.ciphers],
    ['sigalgs', request.sigalgs],
    ['curves', request.ecdhCurve],
    ['ocsp', request.requestOCSP ? '1' : undefined],
  ];
  return lines
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

/** The part of the container's Durable Object namespace the Worker uses. */
export interface ProbeNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

/** The probe could not be made: the container is down, or the target did not answer. */
export class ProbeError extends Error {
  public readonly status: number;

  public constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ProbeError';
    this.status = status;
  }
}

/**
 * Make the probe through the container and return what it saw, as the
 * container wrote it. Throws {@link ProbeError} when the handshake failed (the
 * message is the container's) or the container is not available.
 */
export async function runProbe(
  namespace: ProbeNamespace | undefined,
  request: Readonly<ProbeRequest>,
): Promise<Response> {
  if (!namespace) {
    throw new ProbeError(503, 'TLS probes are not available.');
  }
  const stub = namespace.get(namespace.idFromName('main'));
  const answer = await stub.fetch(
    new Request('https://probe.internal/handshake', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: bodyOf(request),
    }),
  );
  if (answer.status === 502) {
    const body = (await answer.json().catch(() => ({}))) as { error?: string };
    throw new ProbeError(502, body.error ?? 'The handshake failed.');
  }
  if (!answer.ok) {
    throw new ProbeError(503, 'TLS probes are not available.');
  }
  return answer;
}
