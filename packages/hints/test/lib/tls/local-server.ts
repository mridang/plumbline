/**
 * A local `node:tls` server for the TLS tests, plus the helpers that point
 * the hints at it. It uses the certificates in `test/fixtures/tls`, which
 * were generated once with the `openssl` command line tool.
 */
import { readFile } from 'node:fs/promises';
import {
  TLSSocket,
  createSecureContext,
  createServer,
  type Server,
  type TlsOptions,
} from 'node:tls';
import {
  createServer as createTcpServer,
  type AddressInfo,
  type Socket,
} from 'node:net';
import { tlsProbe, connectWithNode } from '../../../src/lib/tls/client.js';

const FIXTURES = new URL('../../fixtures/tls/', import.meta.url);

/** Reads a fixture file by name. */
export function fixture(name: string): Promise<Buffer> {
  return readFile(new URL(name, FIXTURES));
}

/**
 * A minimal OCSP response (status "successful", no body) a server can staple.
 * OpenSSL 3.6 drops a staple that does not parse as an OCSP response, so the
 * tests cannot staple arbitrary text.
 */
export const OCSP_STAPLE = Buffer.from('30030a0100', 'hex');

/** The test CA, trusted by `pointAt` unless told otherwise. */
const CA = await fixture('ca.pem');

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
    cert: await fixture(`${cert}.pem`),
    key: await fixture(`${cert}.key`),
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

/** A running mail server and the port it listens on. */
export interface LocalMailServer {
  port: number;
  /** How many connections were upgraded with STARTTLS. */
  upgrades(): number;
  close(): Promise<void>;
}

export interface LocalMailServerOptions extends LocalServerOptions {
  /** Whether EHLO lists STARTTLS. Defaults to true. */
  starttls?: boolean;
}

/**
 * Starts an SMTP server on 127.0.0.1 with a random port that offers STARTTLS
 * and then speaks TLS with the same options as `startServer`, so a hint can
 * be tested over a STARTTLS upgrade exactly as over HTTPS.
 */
export async function startMailServer(
  options: LocalMailServerOptions = {},
): Promise<LocalMailServer> {
  const {
    cert = 'rsa3072',
    keepOpen = false,
    starttls = true,
    ...rest
  } = options;
  const secureContext = createSecureContext({
    cert: await fixture(`${cert}.pem`),
    key: await fixture(`${cert}.key`),
    ciphers: 'ALL:@SECLEVEL=0',
    // eslint-disable-next-line sonarjs/weak-ssl -- test fixture: the server must offer legacy TLS so the checks can report it
    minVersion: 'TLSv1',
    ...rest,
  });
  const sockets = new Set<Socket>();
  let upgrades = 0;
  const server = createTcpServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => undefined);
    socket.write('220 mail.example.test ESMTP\r\n');
    let buffer = '';
    const onData = (chunk: Buffer): void => {
      buffer += chunk.toString('latin1');
      let end = buffer.indexOf('\r\n');
      while (end !== -1) {
        const line = buffer.slice(0, end).toUpperCase();
        buffer = buffer.slice(end + 2);
        if (line.startsWith('EHLO')) {
          socket.write(
            starttls
              ? '250-mail.example.test\r\n250-STARTTLS\r\n250 8BITMIME\r\n'
              : '250-mail.example.test\r\n250 8BITMIME\r\n',
          );
        } else if (line === 'STARTTLS') {
          socket.write('220 Ready to start TLS\r\n');
          socket.off('data', onData);
          upgrades += 1;
          const secure = new TLSSocket(socket, {
            isServer: true,
            secureContext,
          });
          secure.on('error', () => undefined);
          secure.on('data', () => undefined);
          if (!keepOpen) {
            secure.on('secure', () => secure.end());
          }
          return;
        } else if (line === 'QUIT') {
          socket.end('221 Bye\r\n');
        } else {
          // Any other command gets no reply from this minimal server.
        }
        end = buffer.indexOf('\r\n');
      }
    };
    socket.on('data', onData);
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  return {
    port: (server.address() as AddressInfo).port,
    upgrades: () => upgrades,
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
 * Points the hints at a local mail server and trusts the test CA. Returns a
 * function that restores the defaults; call it in `afterEach`.
 */
export function pointAtMail(port: number, trusted = true): () => void {
  tlsProbe.mailPort = port;
  tlsProbe.ca = trusted ? CA : undefined;
  return restoreProbe;
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
  tlsProbe.mailPort = 25;
  delete tlsProbe.ca;
}
