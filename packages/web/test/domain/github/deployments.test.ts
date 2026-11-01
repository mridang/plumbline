import { describe, expect, it } from '@jest/globals';

import {
  deploymentHosts,
  homepageHost,
  hostOfPattern,
  isWranglerPath,
  stripJsonComments,
  touchesWrangler,
  wranglerHosts,
} from '@/domain/github/deployments';

describe('isWranglerPath', () => {
  it.each([
    'wrangler.jsonc',
    'wrangler.json',
    'wrangler.toml',
    'apps/web/wrangler.jsonc',
  ])('accepts %s', (path) => expect(isWranglerPath(path)).toBe(true));

  it.each([
    'package.json',
    'wrangler.yaml',
    'node_modules/x/wrangler.toml',
    'dist/wrangler.json',
    'my-wrangler.json',
  ])('refuses %s', (path) => expect(isWranglerPath(path)).toBe(false));
});

describe('stripJsonComments', () => {
  it('drops line and block comments and trailing commas, keeping strings', () => {
    const text = '{ // note\n "a": "https://x.test/*", /* b */ "b": [1, 2,], }';
    expect(JSON.parse(stripJsonComments(text))).toEqual({
      a: 'https://x.test/*',
      b: [1, 2],
    });
  });

  it('keeps an escaped quote inside a string', () => {
    expect(JSON.parse(stripJsonComments('{"a": "q\\"//z"}'))).toEqual({
      a: 'q"//z',
    });
  });
});

describe('hostOfPattern', () => {
  it('reads the host of a route pattern, with or without a path or scheme', () => {
    expect(hostOfPattern('Example.com/*')).toBe('example.com');
    expect(hostOfPattern('https://app.example.com/api/*')).toBe(
      'app.example.com',
    );
    expect(hostOfPattern('app.example.com')).toBe('app.example.com');
  });

  it('refuses wildcards, workers.dev and names that are not public', () => {
    expect(hostOfPattern('*.example.com/*')).toBeUndefined();
    expect(hostOfPattern('*/*')).toBeUndefined();
    expect(hostOfPattern('x.me.workers.dev')).toBeUndefined();
    expect(hostOfPattern('localhost')).toBeUndefined();
    expect(hostOfPattern('')).toBeUndefined();
  });
});

describe('wranglerHosts', () => {
  it('reads the custom domains of a wrangler.jsonc', () => {
    const text = `{
      // the app
      "name": "site",
      "routes": [{ "pattern": "site.example.com", "custom_domain": true }, "www.example.com/*"],
    }`;
    expect(wranglerHosts('wrangler.jsonc', text)).toEqual([
      'site.example.com',
      'www.example.com',
    ]);
  });

  it('reads a single route and ignores the environments', () => {
    const text =
      '{"route": "a.example.com/*", "env": {"staging": {"route": "s.example.com/*"}}}';
    expect(wranglerHosts('wrangler.json', text)).toEqual(['a.example.com']);
  });

  it('reads a wrangler.toml, before its environments', () => {
    const text = [
      'name = "site"',
      'routes = ["a.example.com/*", "b.example.com/*"]',
      '[[routes]]',
      'pattern = "c.example.com"',
      'custom_domain = true',
      '[env.staging]',
      'route = "s.example.com/*"',
    ].join('\n');
    expect(wranglerHosts('wrangler.toml', text).toSorted()).toEqual([
      'a.example.com',
      'b.example.com',
      'c.example.com',
    ]);
  });

  it('finds nothing in a configuration without routes or that cannot be read', () => {
    expect(wranglerHosts('wrangler.jsonc', '{"name": "x"}')).toEqual([]);
    expect(wranglerHosts('wrangler.jsonc', 'not json')).toEqual([]);
    expect(wranglerHosts('wrangler.jsonc', '[]')).toEqual([]);
    expect(
      wranglerHosts('wrangler.jsonc', '{"routes": [1, {"pattern": 2}]}'),
    ).toEqual([]);
  });

  it('lists a host once', () => {
    expect(
      wranglerHosts(
        'wrangler.json',
        '{"routes": ["a.example.com/*", "a.example.com/x"]}',
      ),
    ).toEqual(['a.example.com']);
  });
});

describe('homepageHost', () => {
  it('reads a public website', () => {
    expect(homepageHost('https://site.example.com/about')).toBe(
      'site.example.com',
    );
  });

  it('ignores GitHub pages, blanks and nonsense', () => {
    expect(homepageHost('https://mridang.github.io/x')).toBeUndefined();
    expect(homepageHost('https://github.com/mridang/x')).toBeUndefined();
    expect(homepageHost('')).toBeUndefined();
    expect(homepageHost(null)).toBeUndefined();
    expect(homepageHost(undefined)).toBeUndefined();
    expect(homepageHost('http://localhost:3000')).toBeUndefined();
  });
});

describe('deploymentHosts', () => {
  it('collects the hosts of every Wrangler file and the website', async () => {
    const files: Record<string, string> = {
      'wrangler.jsonc': '{"route": "a.example.com/*"}',
      'apps/api/wrangler.toml': 'route = "api.example.com/*"',
    };
    const hosts = await deploymentHosts({
      paths: [
        'README.md',
        'wrangler.jsonc',
        'apps/api/wrangler.toml',
        'node_modules/x/wrangler.toml',
      ],
      read: async (path) => files[path] ?? '',
      homepage: 'https://www.example.com',
    });
    expect(hosts).toEqual([
      'a.example.com',
      'api.example.com',
      'www.example.com',
    ]);
  });

  it('skips a file that cannot be read', async () => {
    const hosts = await deploymentHosts({
      paths: ['wrangler.jsonc'],
      read: async () => {
        throw new Error('gone');
      },
    });
    expect(hosts).toEqual([]);
  });

  it('reads at most eight Wrangler files', async () => {
    const paths = Array.from({ length: 12 }, (_, i) => `p${i}/wrangler.json`);
    const read: string[] = [];
    await deploymentHosts({
      paths,
      read: async (path) => {
        read.push(path);
        return '{}';
      },
    });
    expect(read).toHaveLength(8);
  });
});

describe('touchesWrangler', () => {
  it('is true when a commit adds, changes or removes a Wrangler file', () => {
    expect(touchesWrangler({ commits: [{ added: ['wrangler.jsonc'] }] })).toBe(
      true,
    );
    expect(
      touchesWrangler({ commits: [{ modified: ['a/wrangler.toml'] }] }),
    ).toBe(true);
    expect(touchesWrangler({ commits: [{ removed: ['wrangler.json'] }] })).toBe(
      true,
    );
  });

  it('is false for other files or no commits', () => {
    expect(touchesWrangler({ commits: [{ modified: ['src/index.ts'] }] })).toBe(
      false,
    );
    expect(touchesWrangler({})).toBe(false);
  });
});
