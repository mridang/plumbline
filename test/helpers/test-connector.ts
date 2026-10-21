import { createRequire } from 'node:module';
import type { Engine, IConnector, NetworkData } from 'hint';
import type { HTMLDocument } from '@hint/utils-dom';
import type { HttpHeaders } from '@hint/utils-types';

const require = createRequire(import.meta.url);
const { traverse, createHTMLDocument } = require('@hint/utils-dom');

interface ParserEvents {
  on(
    event: 'parse::end::html',
    listener: (event: {
      document: HTMLDocument;
      resource: string;
    }) => Promise<void>,
  ): void;
}

/** Reads a response into the shape webhint hints expect. */
async function toNetworkData(
  response: Response,
  requestUrl: string,
  requestHeaders: Record<string, string>,
): Promise<NetworkData> {
  const rawContent = Buffer.from(await response.arrayBuffer());
  const headers: HttpHeaders = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const contentType = headers['content-type'] ?? '';
  const [mediaType = '', ...parameters] = String(contentType)
    .split(';')
    .map((part) => part.trim());
  const charset =
    parameters.find((p) => p.startsWith('charset='))?.slice(8) ?? '';
  return {
    request: { headers: requestHeaders, url: requestUrl },
    response: {
      body: {
        content: rawContent.toString('utf8'),
        rawContent,
        rawResponse: () => Promise.resolve(rawContent),
      },
      charset,
      headers,
      hops: [],
      mediaType,
      statusCode: response.status,
      url: requestUrl,
    },
  };
}

/**
 * A minimal connector for tests: it downloads the target with Node's fetch,
 * emits the same events a real connector would, and needs no browser and no
 * native modules.
 */
export default class TestConnector implements IConnector {
  public dom?: HTMLDocument;
  public html?: string;
  public headers?: HttpHeaders;
  private readonly engine: Engine;

  public static schema = { additionalProperties: false, properties: {} };

  public constructor(engine: Engine) {
    this.engine = engine;
    // Parser events are not part of the typed engine events.
    (engine as unknown as ParserEvents).on(
      'parse::end::html',
      async (event) => {
        this.dom = event.document;
        await traverse(event.document, engine, event.resource);
      },
    );
  }

  public async collect(target: URL): Promise<void> {
    const href = target.href;
    await this.engine.emitAsync('scan::start', { resource: href });
    await this.engine.emitAsync('fetch::start::target', { resource: href });
    const data = await this.fetchContent(target);
    this.html = data.response.body.content;
    this.headers = data.response.headers;
    this.dom = createHTMLDocument(this.html, href);
    await this.engine.emitAsync('fetch::end::html', {
      element: null,
      request: data.request,
      resource: href,
      response: data.response,
    });
    await this.engine.emitAsync('scan::end', { resource: href });
  }

  public async fetchContent(
    target: URL | string,
    customHeaders: object = {},
  ): Promise<NetworkData> {
    const url = target.toString();
    const requestHeaders = customHeaders as Record<string, string>;
    const response = await fetch(url, {
      headers: requestHeaders,
      redirect: 'follow',
    });
    return toNetworkData(response, url, requestHeaders);
  }

  public evaluate(): Promise<unknown> {
    return Promise.reject(new Error('evaluate is not supported in tests'));
  }

  public querySelectorAll(query: string) {
    return this.dom ? this.dom.querySelectorAll(query) : [];
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }
}
