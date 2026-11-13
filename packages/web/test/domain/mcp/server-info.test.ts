import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import { SITE_URL } from '@/utils/site';
import {
  CAPABILITIES,
  INSTRUCTIONS,
  SERVER_INFO,
  SERVER_INFO_META_KEY,
  SERVER_VERSION,
  UI_EXTENSION_ID,
} from '@/domain/mcp/server-info';
import { TOOLS } from '@/domain/mcp/tool-definitions';
import { packageDirectorySync } from 'package-directory';

const PACKAGE = packageDirectorySync({ cwd: import.meta.dirname })!;

const root = PACKAGE;

/** The width and height written in a PNG file's header. */
async function pngSize(file: string): Promise<string> {
  const bytes = await readFile(path.join(root, 'public', file));
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe('SERVER_VERSION', () => {
  it('is the version in package.json', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, 'package.json'), 'utf8'),
    ) as { version: string };
    expect(SERVER_VERSION).toBe(manifest.version);
  });
});

describe('SERVER_INFO', () => {
  it('names the server, describes it and points to its website', () => {
    expect(SERVER_INFO).toMatchObject({
      name: 'plumbline',
      title: 'Plumbline',
      version: SERVER_VERSION,
      websiteUrl: 'https://plumbline.apps.mrida.ng',
    });
    expect(SERVER_INFO.description.length).toBeGreaterThan(20);
  });

  it('is keyed in results by the name the protocol reserves', () => {
    expect(SERVER_INFO_META_KEY).toBe('io.modelcontextprotocol/serverInfo');
  });

  it('lists icons that are absolute HTTPS addresses on this site, to real PNG files of the size they claim', async () => {
    expect(SERVER_INFO.icons.length).toBeGreaterThan(0);
    for (const icon of SERVER_INFO.icons) {
      expect(icon.src.startsWith(`${SITE_URL}/icons/`)).toBe(true);
      expect(new URL(icon.src).protocol).toBe('https:');
      expect(icon.mimeType).toBe('image/png');
      const file = new URL(icon.src).pathname.slice(1);
      expect(icon.sizes).toEqual([await pngSize(file)]);
    }
  });
});

describe('CAPABILITIES', () => {
  it('declare tools, resources, prompts and the MCP Apps extension, and nothing the server does not do', () => {
    expect(CAPABILITIES).toEqual({
      tools: {},
      resources: {},
      prompts: {},
      extensions: { 'io.modelcontextprotocol/ui': {} },
    });
    expect(UI_EXTENSION_ID).toBe('io.modelcontextprotocol/ui');
  });

  it('promise no change notifications and no subscriptions', () => {
    expect(CAPABILITIES.tools).not.toHaveProperty('listChanged');
    expect(CAPABILITIES.resources).not.toHaveProperty('listChanged');
    expect(CAPABILITIES.resources).not.toHaveProperty('subscribe');
    expect(CAPABILITIES.prompts).not.toHaveProperty('listChanged');
    for (const unsupported of ['logging', 'completions', 'tasks']) {
      expect(CAPABILITIES).not.toHaveProperty(unsupported);
    }
  });
});

describe('INSTRUCTIONS', () => {
  it('say that the checks never run on the server, and where they do', () => {
    expect(INSTRUCTIONS).toMatch(/never on this server/);
    expect(INSTRUCTIONS).toContain('scan_domain');
  });

  it('only name tools that exist', () => {
    const names = TOOLS.map((t) => t.name) as readonly string[];
    const mentioned = [...INSTRUCTIONS.matchAll(/\b[a-z]+(?:_[a-z]+)+\b/g)].map(
      (m) => m[0],
    );
    expect(mentioned.length).toBeGreaterThan(5);
    for (const name of mentioned) {
      expect(names).toContain(name);
    }
  });

  it('stay short enough to be worth reading on every conversation', () => {
    expect(INSTRUCTIONS.length).toBeLessThan(1800);
  });

  it('say that a domain may be given as a host name or as any URL on it', () => {
    expect(INSTRUCTIONS).toMatch(/host name \(example\.com\) or any URL on it/);
  });

  it('say domains come from GitHub and keep remove_domain for when the user asks', () => {
    expect(INSTRUCTIONS).toMatch(/Domains come from the user's GitHub/);
    expect(INSTRUCTIONS).toMatch(/remove_domain only when the user asks/);
    expect(INSTRUCTIONS).not.toContain('add_domain');
  });
});
