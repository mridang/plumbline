import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** The skills package, and the repository it lives in. */
const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const REPOSITORY = path.join(PACKAGE, '..', '..');

/** A JSON file of the package or the repository. */
function json(...parts: string[]): Record<string, unknown> {
  // eslint-disable-next-line n/no-sync -- sync is fine in a test helper that reads a small JSON file
  return JSON.parse(readFileSync(path.join(...parts), 'utf8')) as Record<
    string,
    unknown
  >;
}

/** The front matter of a Markdown file, as `key: value` pairs. */
function frontMatter(file: string): Record<string, string> {
  // eslint-disable-next-line n/no-sync -- sync is fine in a test helper that reads a small Markdown file
  const text = readFileSync(file, 'utf8');
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

// eslint-disable-next-line n/no-sync -- sync is fine in a test helper: describe-time reads cannot await
const SKILLS = readdirSync(path.join(PACKAGE, 'skills'));

describe('the skills', () => {
  it('include the plumbline skill', () => {
    expect(SKILLS).toContain('plumbline');
  });

  it.each(SKILLS)(
    '%s is named after its folder and says when to use it',
    (name) => {
      const meta = frontMatter(path.join(PACKAGE, 'skills', name, 'SKILL.md'));
      expect(meta['name']).toBe(name);
      expect((meta['description'] ?? '').length).toBeGreaterThan(40);
    },
  );

  it.each(SKILLS)('%s runs the published CLI', (name) => {
    expect(
      // eslint-disable-next-line n/no-sync -- sync is fine in a test helper that reads a small Markdown file
      readFileSync(path.join(PACKAGE, 'skills', name, 'SKILL.md'), 'utf8'),
    ).toContain('npx @mridang/plumbline scan');
  });
});

describe('the Claude Code plugin', () => {
  const plugin = json(PACKAGE, '.claude-plugin', 'plugin.json');
  const pkg = json(PACKAGE, 'package.json');

  it('is named plumbline and leaves its version to the package release', () => {
    expect(plugin['name']).toBe('plumbline');
    expect(plugin).not.toHaveProperty('version');
  });

  it('ships its manifest, commands and skills in the npm package', () => {
    expect(pkg['files']).toEqual(['.claude-plugin', 'commands', 'skills']);
  });

  it('has an audit command that runs the CLI with what it is given', () => {
    const file = path.join(PACKAGE, 'commands', 'audit.md');
    expect(frontMatter(file)['allowed-tools']).toBe(
      'Bash(npx @mridang/plumbline:*)',
    );
    // eslint-disable-next-line n/no-sync -- sync is fine in a test helper that reads a small Markdown file
    expect(readFileSync(file, 'utf8')).toContain(
      'npx @mridang/plumbline scan $ARGUMENTS --format json --fail-on none',
    );
  });
});

describe('the marketplace', () => {
  const marketplace = json(REPOSITORY, '.claude-plugin', 'marketplace.json');
  const plugins = marketplace['plugins'] as { name: string; source: string }[];

  it('lists the plugin from this package', () => {
    expect(plugins).toEqual([
      expect.objectContaining({
        name: 'plumbline',
        source: './packages/skills',
      }),
    ]);
  });

  it('points at a folder that holds the plugin', () => {
    for (const plugin of plugins) {
      expect(
        // eslint-disable-next-line n/no-sync -- sync is fine in a test helper that checks a local folder
        existsSync(
          path.join(REPOSITORY, plugin.source, '.claude-plugin', 'plugin.json'),
        ),
      ).toBe(true);
    }
  });
});
