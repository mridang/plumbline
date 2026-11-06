import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FormatterOptions } from 'hint';
import ExtraFormatter from '../src/index.js';

describe('ExtraFormatter', () => {
  let dir = '';

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('writes the report named after the target and logs its path', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'formatter-'));
    const out = path.join(dir, 'nested');
    await mkdir(out);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const ctor = {
      meta: {
        id: 'extra/csp',
        docs: {
          name: 'CSP',
          description: 'Checks the CSP.',
          category: 'security',
          groups: ['owasp', 'tls'],
          url: 'https://ref.test/csp',
          section: 'https',
          sectionTitle: 'HTTPS and certificates',
          sectionOrder: 0,
          group: 'security-privacy',
          groupTitle: 'Security and privacy',
          subsection: 'csp',
          tags: ['security'],
          tier: 'advanced',
          target: 'web',
          control: 'deployer',
          added: '2026-10',
          origins: [
            {
              source: 'owasp',
              upstreamId: 'csp',
              title: 'CSP test',
              url: 'https://src.test/csp',
              docsUrl: '',
              summary: 'Checks the policy.',
              licence: 'Apache-2.0',
            },
          ],
        },
      },
    };
    await new ExtraFormatter().format(
      [
        {
          hintId: 'extra/csp',
          severity: 4,
          message: 'Missing CSP',
          resource: 'https://a.test/',
          location: { line: -1, column: -1 },
          sourceCode: '',
        } as never,
      ],
      {
        target: 'https://a.test/x?y=1',
        output: out,
        resources: { hints: [ctor] },
      } as unknown as FormatterOptions,
    );
    const files = await readdir(out);
    expect(files).toEqual(['https-a-test-x-query-y-query-1.html']);
    const html = await readFile(path.join(out, files[0] ?? ''), 'utf8');
    expect(html).toContain('HTTPS and certificates');
    expect(html).toContain('<li class="group">Security and privacy</li>');
    expect(html).toContain('<span class="badge">advanced</span>');
    expect(html).toContain('Subsection: csp');
    expect(html).toContain('Fixed by: deployer');
    expect(html).toContain('Looks at: web');
    expect(html).toContain('Added: 2026-10');
    expect(html).toContain('href="https://src.test/csp"');
    expect(html).toContain('Missing CSP');
    expect(log).toHaveBeenCalledWith(
      `You can view the HTML report in "${path.join(out, files[0] ?? '')}"`,
    );
  });

  it('works without resources', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'formatter-'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await new ExtraFormatter().format([], { target: '', output: dir });
    expect(await readdir(dir)).toEqual(['report.html']);
  });
});
