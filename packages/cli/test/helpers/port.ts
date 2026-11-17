import type { Server } from 'node:net';

/** The port a listening server was given; throws when it is not listening on a port. */
export function portOf(server: Server): number {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('the server is not listening on a port');
  }
  return address.port;
}
