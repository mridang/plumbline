import {
  createServer,
  type AddressInfo,
  type Server,
  type Socket,
} from 'node:net';
import { TLSSocket, type SecureVersion } from 'node:tls';
import { TEST_CERT, TEST_KEY } from './test-cert.js';

export interface SmtpOptions {
  /** Whether EHLO lists STARTTLS. Defaults to true. */
  starttls?: boolean;
  /** The first line the server sends. Defaults to a 220 greeting. */
  greeting?: string;
  /** Highest TLS version the server speaks. */
  maxVersion?: SecureVersion;
}

export interface FakeSmtp {
  port: number;
  close(): Promise<void>;
}

/**
 * Starts a tiny SMTP server on a random local port that greets, answers EHLO,
 * optionally offers STARTTLS and upgrades with the test certificate.
 */
export async function startSmtp(options: SmtpOptions = {}): Promise<FakeSmtp> {
  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => undefined);
    socket.write(options.greeting ?? '220 mail.example.test ESMTP\r\n');
    let buffer = '';
    const onData = (chunk: Buffer): void => {
      buffer += chunk.toString('latin1');
      let end = buffer.indexOf('\r\n');
      while (end !== -1) {
        const line = buffer.slice(0, end).toUpperCase();
        buffer = buffer.slice(end + 2);
        if (line.startsWith('EHLO')) {
          socket.write(
            options.starttls === false
              ? '250-mail.example.test\r\n250 8BITMIME\r\n'
              : '250-mail.example.test\r\n250-STARTTLS\r\n250 8BITMIME\r\n',
          );
        } else if (line === 'STARTTLS') {
          socket.write('220 Ready to start TLS\r\n');
          socket.off('data', onData);
          const secure = new TLSSocket(socket, {
            isServer: true,
            key: TEST_KEY,
            cert: TEST_CERT,
            maxVersion: options.maxVersion,
          });
          secure.on('error', () => undefined);
          return;
        } else if (line === 'QUIT') {
          socket.end('221 Bye\r\n');
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
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        server.close(() => resolve());
      }),
  };
}
