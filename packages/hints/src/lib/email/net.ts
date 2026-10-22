import { connect as netConnect } from 'node:net';
import type { ConnectionOptions } from 'node:tls';
import { probeStarttls, type ConnectFn, type StarttlsProbe } from './smtp.js';

/**
 * The network access the mail hints need besides DNS. Hints use
 * `mailNet.client`; tests assign a fake so they never touch the internet.
 */
export interface MailNetClient {
  /** True when a TCP connection to `ip` on `port` succeeds. */
  tcpReachable(ip: string, port: number): Promise<boolean>;
  /** Runs a STARTTLS probe of a mail server on port 25. */
  probeStarttls(host: string): Promise<StarttlsProbe>;
}

export interface MailNetOptions {
  /** Defaults to a plain `net.connect`; tests redirect it to a local server. */
  connect?: ConnectFn;
  tlsOptions?: ConnectionOptions;
  timeoutMs?: number;
}

const defaultConnect: ConnectFn = (host, port, family) =>
  netConnect({ host, port, family });

/** Creates the real client on top of `net` and `tls`. */
export function createMailNetClient(
  options: MailNetOptions = {},
): MailNetClient {
  const connect = options.connect ?? defaultConnect;
  const timeoutMs = options.timeoutMs ?? 10_000;
  return {
    tcpReachable(ip, port) {
      return new Promise((resolve) => {
        const socket = connect(ip, port, ip.includes(':') ? 6 : 4);
        const finish = (reachable: boolean): void => {
          clearTimeout(timer);
          socket.destroy();
          resolve(reachable);
        };
        const timer = setTimeout(() => finish(false), timeoutMs);
        socket.once('connect', () => finish(true));
        socket.once('error', () => finish(false));
      });
    },
    probeStarttls(host) {
      return probeStarttls(host, {
        connect,
        tlsOptions: options.tlsOptions,
        timeoutMs,
      });
    },
  };
}

/** The client hints use; tests assign a fake to `mailNet.client`. */
export const mailNet: { client: MailNetClient } = {
  client: createMailNetClient(),
};
