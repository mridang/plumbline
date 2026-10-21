import { connect, createServer, type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from '@jest/globals';
import { createMailNetClient } from '../../../src/lib/email/net.js';
import { startSmtp, type FakeSmtp } from './fake-smtp.js';

let smtp: FakeSmtp | undefined;

afterEach(async () => {
  await smtp?.close();
  smtp = undefined;
});

describe('createMailNetClient', () => {
  it('reports a reachable port', async () => {
    smtp = await startSmtp();
    const { port } = smtp;
    const client = createMailNetClient({
      connect: () => connect({ host: '127.0.0.1', port }),
    });
    expect(await client.tcpReachable('::1', 25)).toBe(true);
  });

  it('reports an unreachable port', async () => {
    const server = createServer();
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve()),
    );
    const { port } = server.address() as AddressInfo;
    await new Promise((resolve) => server.close(resolve));
    const client = createMailNetClient({
      connect: () => connect({ host: '127.0.0.1', port }),
    });
    expect(await client.tcpReachable('192.0.2.1', 25)).toBe(false);
  });

  it('gives up after the timeout', async () => {
    const client = createMailNetClient({
      // 192.0.2.0/24 is reserved for documentation and never answers.
      connect: () => connect({ host: '192.0.2.1', port: 25 }),
      timeoutMs: 100,
    });
    expect(await client.tcpReachable('192.0.2.1', 25)).toBe(false);
  });

  it('probes a mail server through the injected connect', async () => {
    smtp = await startSmtp();
    const { port } = smtp;
    const client = createMailNetClient({
      connect: () => connect({ host: '127.0.0.1', port }),
      timeoutMs: 3000,
    });
    const result = await client.probeStarttls('mail.example.test');
    expect(result.starttls).toBe(true);
  });
});
