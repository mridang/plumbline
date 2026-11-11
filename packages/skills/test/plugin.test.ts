import { describe, expect, it } from '@jest/globals';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { pathExists } from './helpers/fs.js';

/** The skills package, and the repository it lives in. */
const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const REPOSITORY = path.join(PACKAGE, '..', '..');

/** A JSON file of the package or the repository. */
async function json(...parts: string[]): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(...parts), 'utf8')) as Record<
    string,
    unknown
  >;
}

/** The front matter of a Markdown file, as `key: value` pairs. */
async function frontMatter(file: string): Promise<Record<string, string>> {
  const text = await readFile(file, 'utf8');
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
  return Object.fromEntries(
    block.split('\n').flatMap((line) => {
      const at = line.indexOf(':');
      return at > 0
        ? [[line.slice(0, at).trim(), line.slice(at + 1).trim()]]
        : [];
    }),
  );
}

const SKILLS = await readdir(path.join(PACKAGE, 'skills'));

describe('the skills', () => {
  it('include the plumbline skill', () => {
    expect(SKILLS).toContain('plumbline');
  });

  it.each(SKILLS)(
    '%s is named after its folder and says when to use it',
    async (name) => {
      const meta = await frontMatter(
        path.join(PACKAGE, 'skills', name, 'SKILL.md'),
      );
      expect(meta['name']).toBe(name);
      expect((meta['description'] ?? '').length).toBeGreaterThan(40);
    },
  );

  it.each(SKILLS)('%s runs the published CLI', async (name) => {
    expect(
      await readFile(path.join(PACKAGE, 'skills', name, 'SKILL.md'), 'utf8'),
    ).toContain('npx @mridang/plumbline scan');
  });
});

const PLUGIN = await json(PACKAGE, '.claude-plugin', 'plugin.json');
const PKG = await json(PACKAGE, 'package.json');
const MARKETPLACE = await json(
  REPOSITORY,
  '.claude-plugin',
  'marketplace.json',
);

describe('the Claude Code plugin', () => {
  const plugin = PLUGIN;
  const pkg = PKG;

  it('is named plumbline and leaves its version to the package release', () => {
    expect(plugin['name']).toBe('plumbline');
    expect(plugin).not.toHaveProperty('version');
  });

  it('ships its manifest, commands and skills in the npm package', () => {
    expect(pkg['files']).toEqual(['.claude-plugin', 'commands', 'skills']);
  });

  it('has an audit command that runs the CLI with what it is given', async () => {
    const file = path.join(PACKAGE, 'commands', 'audit.md');
    const meta = await frontMatter(file);
    expect(meta['allowed-tools']).toBe('Bash(npx @mridang/plumbline:*)');
    expect(await readFile(file, 'utf8')).toContain(
      'npx @mridang/plumbline scan $ARGUMENTS --format json --fail-on none',
    );
  });
});

describe('the marketplace', () => {
  const plugins = MARKETPLACE['plugins'] as { name: string; source: string }[];

  it('lists the plugin from this package', () => {
    expect(plugins).toEqual([
      expect.objectContaining({
        name: 'plumbline',
        source: './packages/skills',
      }),
    ]);
  });

  it('points at a folder that holds the plugin', async () => {
    for (const plugin of plugins) {
      expect(
        await pathExists(
          path.join(REPOSITORY, plugin.source, '.claude-plugin', 'plugin.json'),
        ),
      ).toBe(true);
    }
  });
});
