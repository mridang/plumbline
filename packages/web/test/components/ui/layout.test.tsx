import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import { Container, Eyebrow, Heading } from '@/components/ui/layout';
import { classOf, html } from '../render';
import { packageDirectorySync } from 'package-directory';

const PACKAGE = packageDirectorySync({ cwd: import.meta.dirname })!;

/** The Eyebrow tags in a file that set a colour class through className. */
function colourOffenders(file: string, source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/<Eyebrow\b[^>]*className="([^"]*)"/g)) {
    if (/\btext-(ink|accent|subtle|muted|on-ink)\b/.test(match[1]!)) {
      found.push(`${file}: ${match[1]}`);
    }
  }
  return found;
}

describe('Eyebrow', () => {
  it('is a tracked-caps paragraph in the accent colour by default', () => {
    const out = html(<Eyebrow>Your collection</Eyebrow>);
    expect(out.startsWith('<p')).toBe(true);
    expect(classOf(out, 'p')).toContain('uppercase');
    expect(classOf(out, 'p')).toContain('text-accent');
  });

  it('takes its colour from the tone, one at a time', () => {
    expect(classOf(html(<Eyebrow tone="ink">x</Eyebrow>), 'p')).toContain(
      'text-ink',
    );
    expect(classOf(html(<Eyebrow tone="ink">x</Eyebrow>), 'p')).not.toContain(
      'text-accent',
    );
    expect(classOf(html(<Eyebrow tone="subtle">x</Eyebrow>), 'p')).toContain(
      'text-subtle',
    );
  });

  it('can label a term or a heading instead of being a paragraph', () => {
    expect(html(<Eyebrow as="dt">Serves</Eyebrow>).startsWith('<dt')).toBe(
      true,
    );
    expect(html(<Eyebrow as="h3">Cookware</Eyebrow>).startsWith('<h3')).toBe(
      true,
    );
  });

  it('is never given a colour class by a caller, since classes are joined and not merged', async () => {
    // Two colour classes on one element are decided by the order Tailwind
    // generated them in, not by the order they were written. The tone prop is
    // the way to choose a colour.
    const offenders: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const name of await readdir(dir)) {
        const file = path.join(dir, name);
        const info = await stat(file);
        if (info.isDirectory()) {
          await walk(file);
        } else if (
          file.endsWith('.tsx') &&
          !file.includes(`${path.sep}views${path.sep}`)
        ) {
          const source = await readFile(file, 'utf8');
          offenders.push(...colourOffenders(file, source));
        } else {
          // Other files, and the views, may set a colour class themselves.
        }
      }
    };
    await walk(path.join(PACKAGE, 'src'));
    expect(offenders).toEqual([]);
  });
});

describe('Heading', () => {
  it('can be made focusable by script, for moving focus to it between steps', () => {
    const out = html(
      <Heading as="h1" tabIndex={-1}>
        Title
      </Heading>,
    );
    expect(out).toMatch(/<h1 tabindex="-1" class=/);
    expect(html(<Heading>Title</Heading>)).not.toContain('tabindex');
  });

  it('is an h2 in the display face unless told otherwise', () => {
    const out = html(<Heading>Title</Heading>);
    expect(out.startsWith('<h2')).toBe(true);
    expect(classOf(out, 'h2')).toContain('font-display');
  });

  it('sets the tag and the size separately', () => {
    const out = html(
      <Heading as="h1" variant="display">
        Big
      </Heading>,
    );
    expect(out.startsWith('<h1')).toBe(true);
    expect(classOf(out, 'h1')).toContain('text-5xl');
  });
});

describe('Container', () => {
  it('centres the content in the page column', () => {
    expect(classOf(html(<Container>x</Container>), 'div')).toContain('mx-auto');
  });
});
