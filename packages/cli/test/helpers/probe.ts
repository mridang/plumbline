import { deflateSync, gzipSync } from 'node:zlib';

import {
  ProbeClient,
  type ProbeTransport,
} from '../../src/engine/probe/client.js';

/** One request a fake probe was sent. */
export interface Sent {
  readonly path: string;
  readonly body: string;
}

/** The lines of a request body as a map (repeated keys give the last). */
export function linesOf(body: string): Record<string, string> {
  return Object.fromEntries(
    body
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => [
        line.slice(0, line.indexOf('=')),
        line.slice(line.indexOf('=') + 1),
      ]),
  );
}

/** The answer of `/v1/http` for a response. */
export function httpAnswer(
  status: number,
  headers: readonly (readonly [string, string])[],
  body: string | Uint8Array = '',
  statusText = 'OK',
): string {
  const bytes =
    typeof body === 'string' ? Buffer.from(body) : Buffer.from(body);
  return JSON.stringify({
    httpVersion: 'HTTP/1.1',
    status,
    statusText,
    headers,
    body: bytes.toString('base64'),
    truncated: false,
  });
}

/** A chunked body of the pieces. */
export function chunked(...pieces: string[]): Buffer {
  return Buffer.from(
    `${pieces.map((piece) => `${Buffer.byteLength(piece).toString(16)}\r\n${piece}\r\n`).join('')}0\r\n\r\n`,
  );
}

export { deflateSync, gzipSync };

/** A fake probe: `answer` decides each request; every request is kept in `sent`. */
export function fakeProbe(
  answer: (
    path: string,
    body: string,
  ) =>
    | { status: number; text: string }
    | Promise<{ status: number; text: string }>,
): { client: ProbeClient; sent: Sent[]; transport: ProbeTransport } {
  const sent: Sent[] = [];
  const transport: ProbeTransport = async (path, body) => {
    sent.push({ path, body });
    return answer(path, body);
  };
  return { client: new ProbeClient(transport, { waitMs: 1 }), sent, transport };
}

/** The `ok` answer carrying `text`. */
export const ok = (text: string): { status: number; text: string } => ({
  status: 200,
  text,
});

/** A handshake answer for a protocol and cipher. */
export function handshakeAnswer(
  protocol = 'TLSv1.3',
  cipher = 'TLS_AES_256_GCM_SHA384',
): Record<string, unknown> {
  return {
    protocol,
    cipher: { name: cipher, standardName: cipher },
    authorized: true,
    authorizationError: null,
    ephemeral: { type: 'ECDH', size: 253, name: 'X25519' },
    chain: ['AAEC'],
    certificates: [
      {
        subject: { CN: 'example.com' },
        issuer: { CN: 'Example CA' },
        subjectaltname: 'DNS:example.com',
        valid_from: 'Jan  1 00:00:00 2026 GMT',
        valid_to: 'Jan  1 00:00:00 2027 GMT',
        serialNumber: '01',
        fingerprint256: 'AA:BB',
        keyType: 'EC',
        signatureAlgorithm: 'ecdsa-with-SHA256',
        infoAccess: { 'OCSP - URI': ['http://ocsp.example.com'] },
      },
    ],
    ocsp: null,
    compression: false,
  };
}
