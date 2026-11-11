import { describe, expect, it } from '@jest/globals';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  ACCEPT_ENCODING,
  probeContentEncoding,
} from '../../../src/lib/network/compression.js';

const serve = async (
  headers: Record<string, string>,
): Promise<{ url: URL; seen: () => string; close: () => Promise<void> }> => {
  let accept = '';
  const server = createServer((req, res) => {
    accept = String(req.headers['accept-encoding'] ?? '');
    res.writeHead(200, headers);
    res.end('x');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: new URL(`http://127.0.0.1:${port}/`),
    seen: () => accept,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
};

describe('probeContentEncoding', () => {
  it('offers every encoding and returns the Content-Encoding header', async () => {
    const s = await serve({ 'content-encoding': 'gzip' });
    try {
      expect(await probeContentEncoding(s.url)).toBe('gzip');
      expect(s.seen()).toBe(ACCEPT_ENCODING);
    } finally {
      await s.close();
    }
  });

  it('returns an empty string for an uncompressed response', async () => {
    const s = await serve({});
    try {
      expect(await probeContentEncoding(s.url)).toBe('');
    } finally {
      await s.close();
    }
  });

  it('returns null when the server cannot be reached', async () => {
    const s = await serve({});
    await s.close();
    expect(await probeContentEncoding(s.url)).toBeNull();
  });
});
