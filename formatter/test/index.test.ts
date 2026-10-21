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
    expect(html).toContain('TLS and certificates');
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
