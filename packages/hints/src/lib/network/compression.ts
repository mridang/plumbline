/**
 * HTTP compression check ported from Internet.nl
 * (checks/tasks/http_headers.py, `HeaderCheckerContentEncoding`): ask the
 * web server for `/` offering every common encoding and flag the response
 * when it carries a non-empty `Content-Encoding` header. Compressed
 * responses make HTTPS vulnerable to BREACH-style attacks.
 */
import { request as httpRequest } from '#http';
import { request as httpsRequest } from '#https';

/** The encodings Internet.nl offers, so any server preference shows up. */
export const ACCEPT_ENCODING =
  'br, compress, deflate, exi, gzip, pack200-gzip, x-compress, x-gzip, zstd';

/** Returns the `Content-Encoding` of `GET <url>` or null when unreachable. */
export type EncodingProbe = (url: URL) => Promise<string | null>;

/** Real probe: reads only the response headers, never the body. */
export const probeContentEncoding: EncodingProbe = (url) =>
  new Promise((resolve) => {
    const make = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = make(
      url,
      {
        method: 'GET',
        headers: {
          'accept-encoding': ACCEPT_ENCODING,
          'user-agent': 'plumbline',
        },
        timeout: 10_000,
      },
      (res) => {
        const raw = res.headers['content-encoding'];
        const value = (
          Array.isArray(raw) ? raw.join(', ') : (raw ?? '')
        ).trim();
        res.destroy();
        resolve(value);
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
    req.end();
  });

/** The probe the hint uses; tests may assign a fake. */
export const compression: { probe: EncodingProbe } = {
  probe: probeContentEncoding,
};
