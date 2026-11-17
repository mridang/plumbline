import { connect } from '#net';
import { probeStarttls } from './smtp.js';
import type { ConnectFn, StarttlsProbe } from './smtp.js';
import type { ConnectionOptions } from '#tls';

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
  connect({ host, port, family });

/** Creates the real client on top of `net` and `tls`. */
export function createMailNetClient(
  options: MailNetOptions = {},
): MailNetClient {
  const connectTo = options.connect ?? defaultConnect;
  const timeoutMs = options.timeoutMs ?? 10_000;
  return {
    async tcpReachable(ip, port) {
      return new Promise((resolve) => {
        const socket = connectTo(ip, port, ip.includes(':') ? 6 : 4);
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
    async probeStarttls(host) {
      return probeStarttls(host, {
        connect: connectTo,
        tlsOptions: options.tlsOptions,
        timeoutMs,
      });
    },
  };
}

/** The holder of the client hints use. */
export interface MailNet {
  client: MailNetClient;
}

/** The client hints use; tests assign a fake to `mailNet.client`. */
export const mailNet: MailNet = {
  client: createMailNetClient(),
};
