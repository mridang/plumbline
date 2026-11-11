import { traverse, createHTMLDocument } from '@hint/utils-dom';
import type { Engine, IConnector, NetworkData } from 'hint';
import type { HTMLDocument } from '@hint/utils-dom';
import type { HttpHeaders } from '@hint/utils-types';

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
  // Fetch folds repeated Set-Cookie headers into one string, which cannot be
  // split safely because cookie dates contain commas, so keep them as a list.
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) {
    headers['set-cookie'] = cookies as unknown as string;
  }
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

const notConfigured: (code: string) => unknown = () => {
  throw new Error('evaluate is not configured for this test');
};

let evaluateImpl: (code: string) => unknown = notConfigured;

/**
 * Sets what `context.evaluate(code)` returns for the next scans, so tests
 * can stand in for the browser a real connector would provide.
 */
export function setEvaluate(fn: (code: string) => unknown): void {
  evaluateImpl = fn;
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

  public static readonly schema = {
    additionalProperties: false,
    properties: {},
  };

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
    await this.fetchSubresources(target);
    await this.engine.emitAsync('scan::end', { resource: href });
  }

  /**
   * Downloads the images, scripts and stylesheets the page references and
   * emits a `fetch::end` event for each, as a browser based connector does.
   */
  private async fetchSubresources(base: URL): Promise<void> {
    const found: { element: unknown; url: string; kind: string }[] = [];
    const add = (selector: string, attribute: string, kind: string) => {
      for (const element of this.dom?.querySelectorAll(selector) ?? []) {
        const value = element.getAttribute(attribute);
        if (!value) {
          continue;
        }
        try {
          found.push({ element, url: new URL(value, base).href, kind });
        } catch {
          // A malformed URL in the markup is skipped, as a browser would.
        }
      }
    };
    add('script[src]', 'src', 'script');
    add('img[src]', 'src', 'image');
    add('link[rel~="stylesheet"][href]', 'href', 'css');
    for (const { element, url, kind } of found) {
      try {
        const data = await this.fetchContent(url);
        await this.engine.emitAsync(
          `fetch::end::${kind}` as 'fetch::end::*',
          {
            element,
            request: data.request,
            resource: url,
            response: data.response,
          } as never,
        );
      } catch {
        // A resource that cannot be downloaded is not reported here.
      }
    }
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

  public async evaluate(code: string): Promise<unknown> {
    return evaluateImpl(code);
  }

  public querySelectorAll(query: string) {
    return this.dom ? this.dom.querySelectorAll(query) : [];
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }
}
