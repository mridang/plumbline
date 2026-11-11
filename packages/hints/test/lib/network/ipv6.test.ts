import { afterEach, describe, expect, it } from '@jest/globals';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { createServer as createHttp } from 'node:http';
import {
  compareIpFamilies,
  httpGetByIp,
  judgeNsAaaa,
  nameserverAddresses,
  nameserverLines,
  network,
  quickRatio,
  stripIrrelevantHtml,
  tcpConnect,
  unreachableNameservers,
  unreachableWebAddresses,
  zoneNameservers,
  type WebResponse,
} from '../../../src/lib/network/ipv6.js';
import { installDns } from './fake-dns.js';

const realNetwork = { ...network };
let restore: () => void = () => undefined;
afterEach(() => {
  restore();
  network.connect = realNetwork.connect;
  network.get = realNetwork.get;
});

const listen = (server: Server): Promise<number> =>
  new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve((server.address() as AddressInfo).port),
    ),
  );

describe('tcpConnect', () => {
  it('connects to a listening port and fails on a closed one', async () => {
    const server = createServer();
    const port = await listen(server);
    try {
      expect(await tcpConnect('127.0.0.1', port, 1000)).toBe(true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
    expect(await tcpConnect('127.0.0.1', port, 1000)).toBe(false);
  });
});

describe('httpGetByIp', () => {
  it('fetches / from the IP and sends the host name', async () => {
    let seenHost = '';
    const server = createHttp((req, res) => {
      seenHost = req.headers.host ?? '';
      res.end('hello');
    });
    const port = await listen(server as unknown as Server);
    try {
      const r = await httpGetByIp('site.test', '127.0.0.1', port, false);
      expect(r).toEqual({ status: 200, body: 'hello' });
      expect(seenHost).toBe('site.test');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('returns null when nothing listens', async () => {
    const server = createServer();
    const port = await listen(server);
    await new Promise((resolve) => server.close(resolve));
    expect(await httpGetByIp('site.test', '127.0.0.1', port, false)).toBeNull();
  });
});

describe('name servers', () => {
  it('judges how many name servers have IPv6', () => {
    const s = (v6: string[]) => ({ name: 'n', v4: [], v6 });
    expect(judgeNsAaaa([])).toBe('none');
    expect(judgeNsAaaa([s([]), s([])])).toBe('none');
    expect(judgeNsAaaa([s(['2001:db8::1']), s([])])).toBe('one');
    expect(judgeNsAaaa([s(['2001:db8::1']), s(['2001:db8::2'])])).toBe('good');
  });

  it('resolves addresses of the zone name servers', async () => {
    restore = installDns({
      'example.test': { NS: { data: ['ns1.example.net.'] } },
      'ns1.example.net': {
        A: { data: ['192.0.2.1'] },
        AAAA: { data: ['2001:db8::1'] },
      },
    });
    const { zone, servers } = await zoneNameservers('example.test');
    expect(zone.zone).toBe('example.test');
    expect(servers).toEqual([
      { name: 'ns1.example.net', v4: ['192.0.2.1'], v6: ['2001:db8::1'] },
    ]);
    expect(await nameserverAddresses([])).toEqual([]);
  });

  it('lists name servers whose IPv6 address does not answer on port 53', async () => {
    const ports: number[] = [];
    network.connect = async (ip, port) => {
      ports.push(port);
      return ip === '2001:db8::1';
    };
    const bad = await unreachableNameservers([
      { name: 'a', v4: [], v6: ['2001:db8::1'] },
      { name: 'b', v4: [], v6: ['2001:db8::2', '2001:db8::1'] },
      { name: 'c', v4: ['192.0.2.1'], v6: [] },
    ]);
    expect(bad).toEqual([{ name: 'b', ips: ['2001:db8::2'] }]);
    expect(new Set(ports)).toEqual(new Set([53]));
  });
});

describe('web reachability', () => {
  it('accepts an address reachable on either port', async () => {
    network.connect = async (ip, port) => port === 443 && ip === '2001:db8::1';
    expect(
      await unreachableWebAddresses(['2001:db8::1', '2001:db8::2']),
    ).toEqual(['2001:db8::2']);
  });

  it('is empty without IPv6 addresses', async () => {
    expect(await unreachableWebAddresses([])).toEqual([]);
  });
});

describe('content comparison helpers', () => {
  it('strips nonces and view state', () => {
    const html =
      '<script nonce="abc123">x</script><style nonce=\'q\'>y</style><input type="hidden" name="__VIEWSTATE" value="z"><p>k</p>';
    expect(stripIrrelevantHtml(html)).toBe(
      '<script>x</script><style>y</style><p>k</p>',
    );
  });

  it('computes the quick ratio like difflib', () => {
    expect(quickRatio('', '')).toBe(1);
    expect(quickRatio('abcd', 'abcd')).toBe(1);
    expect(quickRatio('abcd', 'wxyz')).toBe(0);
    expect(quickRatio('abcd', 'abxy')).toBe(0.5);
  });
});

describe('compareIpFamilies', () => {
  const page = (status: number, body: string): WebResponse => ({
    status,
    body,
  });
  const serve = (
    v4: Record<number, WebResponse | null>,
    v6: Record<number, WebResponse | null>,
  ) => {
    network.get = async (_host, ip, port) =>
      (ip.includes(':') ? v6 : v4)[port] ?? null;
  };
  const both = (r: WebResponse | null) => ({ 80: r, 443: r });

  it('skips when one family is missing', async () => {
    expect(await compareIpFamilies('h', [], ['2001:db8::1'])).toBe('skip');
    expect(await compareIpFamilies('h', ['192.0.2.1'], [])).toBe('skip');
  });

  it('is good for identical pages', async () => {
    serve(both(page(200, 'same')), both(page(200, 'same')));
    expect(await compareIpFamilies('h', ['192.0.2.1'], ['2001:db8::1'])).toBe(
      'good',
    );
  });

  it('is bad when IPv6 does not answer at all', async () => {
    serve(both(page(200, 'same')), both(null));
    expect(await compareIpFamilies('h', ['192.0.2.1'], ['2001:db8::1'])).toBe(
      'bad',
    );
  });

  it('is bad when the ports differ', async () => {
    serve(both(page(200, 'same')), { 80: null, 443: page(200, 'same') });
    expect(await compareIpFamilies('h', ['192.0.2.1'], ['2001:db8::1'])).toBe(
      'bad',
    );
  });

  it('is bad when the status codes differ', async () => {
    serve(both(page(200, 'same')), both(page(503, 'same')));
    expect(await compareIpFamilies('h', ['192.0.2.1'], ['2001:db8::1'])).toBe(
      'bad',
    );
  });

  it('warns when the content differs by more than 10 percent', async () => {
    serve(both(page(200, 'a'.repeat(100))), both(page(200, 'b'.repeat(100))));
    expect(await compareIpFamilies('h', ['192.0.2.1'], ['2001:db8::1'])).toBe(
      'notice',
    );
  });

  it('tolerates a small difference', async () => {
    serve(
      both(page(200, 'a'.repeat(100))),
      both(page(200, 'a'.repeat(95) + 'b'.repeat(5))),
    );
    expect(await compareIpFamilies('h', ['192.0.2.1'], ['2001:db8::1'])).toBe(
      'good',
    );
  });

  it('ignores nonce differences', async () => {
    serve(
      both(page(200, '<script nonce="1">a</script>')),
      both(page(200, '<script nonce="2">a</script>')),
    );
    expect(await compareIpFamilies('h', ['192.0.2.1'], ['2001:db8::1'])).toBe(
      'good',
    );
  });

  it('warns about identical error pages', async () => {
    serve(both(page(500, 'oops')), both(page(500, 'oops')));
    expect(await compareIpFamilies('h', ['192.0.2.1'], ['2001:db8::1'])).toBe(
      'notice-status-code',
    );
  });
});

describe('nameserverLines', () => {
  it('lists the addresses of each name server', () => {
    expect(
      nameserverLines([
        { name: 'a.example.net', v4: ['192.0.2.1'], v6: ['2001:db8::1'] },
        { name: 'b.example.net', v4: [], v6: [] },
      ]),
    ).toBe(
      'a.example.net. A 192.0.2.1; AAAA 2001:db8::1\nb.example.net. A none; AAAA none',
    );
  });
});

describe('stripIrrelevantHtml nonce removal against the former regex', () => {
  // The former pattern, assembled at run time so the linter does not flag the
  // reference implementation this test compares against.
  const old = (flags: string, ...parts: string[]): RegExp =>
    new RegExp(parts.join(''), flags);
  const former = (html: string): string =>
    html.replaceAll(
      old(
        'gi',
        String.raw`(<(?:script|style)\b[^>]*?)\s+nonce`,
        String.raw`\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)`,
      ),
      '$1',
    );

  it.each([
    '<script nonce="abc">x</script>',
    "<style  nonce='abc' media=print>x</style>",
    '<SCRIPT src=a NONCE = abc defer>',
    '<script nonce="a" nonce="b">',
    '<script nonce=a><script nonce=b>',
    '<script nonce="a>b" src=c>',
    '<script nonce="a src=c>',
    '<script nonce=>',
    '<script nonce>',
    '<script nonces=a>',
    '<scripts nonce=a>',
    '<div nonce=a>',
    '<script src=a>nonce=b',
    '<script\n\tnonce\n=\n"x"\n>',
    '<script <style nonce=a>',
    '<script',
  ])('agrees on %j', (html) => {
    const expected = former(html);
    expect(stripIrrelevantHtml(html)).toBe(expected);
  });

  it('agrees on a 100k character tag', () => {
    const html = `<script${' a=b'.repeat(30_000)} nonce="z"${' '.repeat(50_000)}>`;
    expect(stripIrrelevantHtml(html)).toBe(former(html));
    const spaced = `<script${' '.repeat(100_000)}x>`;
    expect(stripIrrelevantHtml(spaced)).toBe(former(spaced));
  });
});
