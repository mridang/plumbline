import { describe, expect, it } from '@jest/globals';
import Checks from '../../src/commands/checks.js';
import { EXIT } from '../../src/exit-code.js';
import type { HintMeta } from '../../src/scan.js';
import { runCommand } from '../helpers/command.js';

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

/** Runs `plumbline checks` with `argv` against the test catalogue. */
function run(argv: string[]) {
  const [, ...rest] = argv;
  return runCommand(Checks, rest, {
    catalogue: () => CATALOGUE,
    version: '9.9.9',
  });
}

describe('plumbline checks', () => {
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

  it('refuses a scan option, which only applies to scan', async () => {
    const result = await run(['checks', '--only', 'csp']);
    expect(result.code).toBe(EXIT.usage);
  });

  it('lets a broken catalogue fail loudly', async () => {
    await expect(
      runCommand(Checks, [], {
        catalogue: () => {
          throw new Error('broken catalogue');
        },
        version: '1',
      }),
    ).rejects.toThrow('broken catalogue');
  });
});
