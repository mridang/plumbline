/**
 * A local `node:tls` server for the TLS tests, plus the helpers that point
 * the hints at it. It uses the certificates in `test/fixtures/tls`, which
 * were generated once with the `openssl` command line tool.
 */
import { readFileSync } from 'node:fs';
import { createServer, type Server, type TlsOptions } from 'node:tls';
import type { AddressInfo, Socket } from 'node:net';
import { tlsProbe, connectWithNode } from '../../../src/lib/tls/client.js';

const FIXTURES = new URL('../../fixtures/tls/', import.meta.url);

/** Reads a fixture file by name. */
export function fixture(name: string): Buffer {
  return readFileSync(new URL(name, FIXTURES));
}

/** The test CA, trusted by `pointAt` unless told otherwise. */
const CA = fixture('ca.pem');

export interface LocalServerOptions extends TlsOptions {
  /** Fixture basename of the certificate and key, default `rsa3072`. */
  cert?: string;
  /** Keep accepted connections open (renegotiation and 0-RTT need that). */
  keepOpen?: boolean;
}

/** A running server and the port it listens on. */
export interface LocalServer {
  server: Server;
  port: number;
  close(): Promise<void>;
}

/** Starts a TLS server on 127.0.0.1 with a random port. */
export async function startServer(
  options: LocalServerOptions = {},
): Promise<LocalServer> {
  const { cert = 'rsa3072', keepOpen = false, ...rest } = options;
  const server = createServer({
    cert: fixture(`${cert}.pem`),
    key: fixture(`${cert}.key`),
    // Legacy protocols and suites are part of what the tests exercise.
    ciphers: 'ALL:@SECLEVEL=0',
    minVersion: 'TLSv1',
    ...rest,
  });
  // The tests do not care about client errors of aborted probe handshakes.
  server.on('tlsClientError', () => undefined);
  const sockets = new Set<Socket>();
  server.on('secureConnection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => undefined);
    if (keepOpen) {
      // Read and ignore what the client sends so the connection stays up.
      socket.on('data', () => undefined);
    } else {
      socket.end();
    }
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  return {
    server,
    port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        for (const socket of sockets) {
          socket.destroy();
        }
      }),
  };
}

/**
 * Points the hints at a local server and trusts the test CA. Returns a
 * function that restores the defaults; call it in `afterEach`.
 */
export function pointAt(port: number, trusted = true): () => void {
  tlsProbe.port = port;
  tlsProbe.ca = trusted ? CA : undefined;
  return restoreProbe;
}

/** Restores the production probe settings. */
export function restoreProbe(): void {
  tlsProbe.connect = connectWithNode;
  tlsProbe.port = 443;
  tlsProbe.ca = undefined;
}
