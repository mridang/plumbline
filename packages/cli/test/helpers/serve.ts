import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** A local site for a real scan: its URL and a way to stop it. */
export interface LocalSite {
  url: string;
  close(): Promise<void>;
}

/**
 * Serves one small HTML page on 127.0.0.1 with the given response headers,
 * so a real scan can run without touching the internet.
 * @param headers - Extra response headers for every path.
 * @returns The page's URL and a function that stops the server.
 */
export async function serve(
  headers: Record<string, string> = {},
): Promise<LocalSite> {
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      ...headers,
    });
    res.end(
      '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
    );
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
