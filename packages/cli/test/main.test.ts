import { afterEach, describe, expect, it } from '@jest/globals';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Severity, type Problem } from '@hint/utils-types';
import { findBrowser } from '../src/browser.js';
import { EXIT } from '../src/exit-code.js';
import { HELP } from '../src/help.js';
import { main, type Dependencies } from '../src/main.js';
import type { HintMeta, ScanOptions, ScanResult } from '../src/scan.js';
import { serve } from './helpers/serve.js';

const CATALOGUE: HintMeta[] = [
  {
    id: 'csp',
    name: 'Content Security Policy',
    description: 'Checks the CSP header.',
    category: 'security',
    groups: ['owasp'],
  },
  {
    id: 'spf',
    name: 'SPF',
    description: 'Checks the SPF record.',
    category: 'email',
    groups: ['email'],
  },
];

function problem(severity: Severity): Problem {
  return {
    location: { line: -1, column: -1 },
    message: 'missing CSP',
    sourceCode: 'Content-Security-Policy: default-src',
    resource: 'https://example.com/',
    hintId: 'extra/csp',
    category: 'security' as unknown as Problem['category'],
    severity,
  };
}

/** Captures what a run prints and what it asked the scan to do. */
async function run(
  argv: string[],
  options: { problems?: Problem[]; scan?: Dependencies['scan'] } = {},
) {
  const out: string[] = [];
  const err: string[] = [];
  const calls: { url: string; options?: ScanOptions }[] = [];
  const scan =
    options.scan ??
    (async (url: string, scanOptions?: ScanOptions): Promise<ScanResult> => {
      calls.push({ url, options: scanOptions });
      return {
        problems: options.problems ?? [],
        hints: CATALOGUE.filter((h) => scanOptions?.hints?.includes(h.id)),
      };
    });
  const code = await main(
    argv,
    { stdout: (t) => out.push(t), stderr: (t) => err.push(t) },
    {
      scan,
      catalogue: () => CATALOGUE,
      version: '9.9.9',
      findBrowser: () => '/found/chrome',
    },
  );
  return { code, stdout: out.join(''), stderr: err.join(''), calls };
}

describe('main', () => {
  let dir = '';

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = '';
    }
  });

  it('prints the help', async () => {
    expect(await run(['--help'])).toMatchObject({
      code: EXIT.ok,
      stdout: HELP,
    });
  });

  it('prints the version', async () => {
    expect(await run(['--version'])).toMatchObject({
      code: EXIT.ok,
      stdout: '9.9.9\n',
    });
  });

  it('reports a usage mistake on stderr with the usage status', async () => {
    const result = await run(['scan']);
    expect(result.code).toBe(EXIT.usage);
    expect(result.stderr).toContain('plumbline: scan needs a URL');
    expect(result.stderr).toContain('plumbline --help');
  });

  it('refuses an unknown check before scanning', async () => {
    const result = await run(['scan', 'example.com', '--only', 'nope']);
    expect(result.code).toBe(EXIT.usage);
    expect(result.calls).toEqual([]);
  });

  it('lists the checks as text', async () => {
    const result = await run(['checks']);
    expect(result.code).toBe(EXIT.ok);
    expect(result.stdout).toContain('csp  Content Security Policy');
    expect(result.stdout).toContain('2 checks');
  });

  it('lists the checks of a group as JSON', async () => {
    const result = await run([
      'checks',
      '--group',
      'email',
      '--format',
      'json',
    ]);
    expect(JSON.parse(result.stdout)).toEqual([
      {
        id: 'spf',
        name: 'SPF',
        groups: ['email'],
        description: 'Checks the SPF record.',
      },
    ]);
  });

  it('scans the normalised URL with the selected hints', async () => {
    const result = await run(['scan', 'example.com', '--skip', 'spf']);
    expect(result.calls).toEqual([
      {
        url: 'https://example.com/',
        options: {
          hints: ['csp'],
          executablePath: '/found/chrome',
          browserArgs: [],
        },
      },
    ]);
    expect(result.stderr).toBe('Scanning https://example.com/ with 1 check…\n');
  });

  it('passes --browser and --no-sandbox to the scan', async () => {
    const result = await run([
      'scan',
      'example.com',
      '--browser',
      '/my/chrome',
      '--no-sandbox',
    ]);
    expect(result.calls[0].options).toMatchObject({
      executablePath: '/my/chrome',
      browserArgs: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  });

  it('prints text findings and fails on an error', async () => {
    const result = await run(['scan', 'example.com'], {
      problems: [problem(Severity.error)],
    });
    expect(result.code).toBe(EXIT.findings);
    expect(result.stdout).toContain('csp (Content Security Policy)');
    expect(result.stdout).toContain('1 finding from 2 checks');
  });

  it('passes on a warning by default', async () => {
    const result = await run(['scan', 'example.com'], {
      problems: [problem(Severity.warning)],
    });
    expect(result.code).toBe(EXIT.ok);
  });

  it('fails on a warning with --fail-on warning', async () => {
    const result = await run(['scan', 'example.com', '--fail-on', 'warning'], {
      problems: [problem(Severity.warning)],
    });
    expect(result.code).toBe(EXIT.findings);
  });

  it('prints JSON findings', async () => {
    const result = await run(['scan', 'example.com', '--format', 'json'], {
      problems: [problem(Severity.error)],
    });
    expect(JSON.parse(result.stdout)).toEqual([
      {
        hint: 'csp',
        severity: 'error',
        message: 'missing CSP',
        resource: 'https://example.com/',
        codeSnippet: 'Content-Security-Policy: default-src',
      },
    ]);
  });

  it('writes the HTML and JSON reports for --format html', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'plumbline-main-'));
    const result = await run(
      ['scan', 'example.com', '--format', 'html', '--out', dir],
      { problems: [problem(Severity.error)] },
    );
    expect(result.code).toBe(EXIT.findings);
    expect((await readdir(dir)).sort()).toEqual([
      'https-example-com.html',
      'https-example-com.json',
    ]);
    expect(result.stdout).toContain(
      `Wrote ${path.join(dir, 'https-example-com.html')}`,
    );
  });

  it('reports a failed scan with its own status', async () => {
    const result = await run(['scan', 'example.com'], {
      scan: async () => {
        throw new Error('No installation found');
      },
    });
    expect(result.code).toBe(EXIT.failed);
    expect(result.stderr).toContain(
      'the scan of https://example.com/ failed: No installation found',
    );
    expect(result.stderr).toContain('--browser');
  });

  it('reports a failed scan that threw a non-error', async () => {
    const result = await run(['scan', 'example.com'], {
      scan: () => Promise.reject('boom'),
    });
    expect(result.stderr).toContain('failed: boom');
  });

  it('rethrows what is not a usage mistake', async () => {
    await expect(
      main(
        ['checks'],
        { stdout: () => {}, stderr: () => {} },
        {
          catalogue: () => {
            throw new Error('broken catalogue');
          },
          version: '1',
        },
      ),
    ).rejects.toThrow('broken catalogue');
  });

  // The whole command against a local page, with a real browser and the real
  // hints: the page sends no CSP, so the scan fails and says so in JSON.
  it('scans a live page end to end', async () => {
    const site = await serve();
    try {
      const out: string[] = [];
      const code = await main(
        ['scan', site.url, '--only', 'csp', '--format', 'json', '--no-sandbox'],
        { stdout: (t) => out.push(t), stderr: () => {} },
        { findBrowser },
      );
      expect(code).toBe(EXIT.findings);
      const findings = JSON.parse(out.join('')) as { hint: string }[];
      expect(findings.map((f) => f.hint)).toContain('csp');
    } finally {
      await site.close();
    }
  });
});
