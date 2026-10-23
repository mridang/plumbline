import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { buildReport, saveReport } from './report.js';
import {
  hintCatalogue,
  scan as defaultScan,
  type ScanOptions,
  type ScanResult,
} from './scan.js';

/** The JSON body `/scan` accepts. */
interface ScanRequest {
  url?: unknown;
  hints?: unknown;
  out?: unknown;
}

/** The scan function the server calls; injectable so tests can fake it. */
export type ScanFn = (
  url: string,
  options?: ScanOptions,
) => Promise<ScanResult>;

/** Writes a JSON response with the given status. */
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** Reads the whole request body, rejecting anything larger than 1 MiB. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Handles `POST /scan`: parse the body, scan, and answer with the report. */
async function handleScan(
  req: IncomingMessage,
  res: ServerResponse,
  scan: ScanFn,
): Promise<void> {
  let body: ScanRequest;
  try {
    const raw = await readBody(req);
    body = raw ? (JSON.parse(raw) as ScanRequest) : {};
  } catch {
    sendJson(res, 400, { error: 'body must be valid JSON' });
    return;
  }

  if (typeof body.url !== 'string' || !/^https?:\/\//.test(body.url)) {
    sendJson(res, 400, { error: 'url must be an http(s) URL' });
    return;
  }

  const hints =
    Array.isArray(body.hints) &&
    body.hints.every((h): h is string => typeof h === 'string')
      ? body.hints
      : undefined;

  // A report is written to disk when the request asks for it or the image was
  // started with OUTPUT_DIR pointing at a mounted host directory.
  const out =
    typeof body.out === 'string'
      ? body.out
      : (process.env.OUTPUT_DIR ?? undefined);

  try {
    const result = await scan(body.url, {
      hints,
      executablePath: process.env.CHROMIUM_PATH,
    });
    const report = buildReport(body.url, result);
    const saved = out
      ? await saveReport(body.url, report, result, out)
      : undefined;
    sendJson(res, 200, saved ? { ...report, saved } : report);
  } catch (error) {
    sendJson(res, 500, {
      error: 'scan failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

/** The request router: three endpoints, everything else is a 404. */
function handle(req: IncomingMessage, res: ServerResponse, scan: ScanFn): void {
  const path = (req.url ?? '/').split('?')[0];
  if (req.method === 'GET' && path === '/healthz') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }
  if (req.method === 'GET' && path === '/hints') {
    sendJson(res, 200, { hints: hintCatalogue() });
    return;
  }
  if (req.method === 'POST' && path === '/scan') {
    void handleScan(req, res, scan);
    return;
  }
  sendJson(res, 404, { error: 'not found' });
}

/** Options for the server; the scan implementation can be replaced in tests. */
export interface ServerOptions {
  scan?: ScanFn;
}

/** Creates the HTTP server without starting it (used by tests). */
export function createScanServer(options: ServerOptions = {}): Server {
  const scan = options.scan ?? defaultScan;
  return createServer((req, res) => handle(req, res, scan));
}

/** Starts the server on HOST/PORT; the Docker image's entry point. */
export function start(): Server {
  const port = Number(process.env.PORT ?? 8080);
  const host = process.env.HOST ?? '0.0.0.0';
  const server = createScanServer();
  server.listen(port, host, () => {
    console.log(`webhint scan server listening on http://${host}:${port}`);
  });
  return server;
}

// Start only when run as the entry point, not when imported by a test.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  start();
}
