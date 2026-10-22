import { describe, expect, it } from '@jest/globals';
import {
  BACKUP_PROBES,
  confirmsBackup,
  isExposedSourceMap,
  isPermissiveCrossdomain,
  looksLikeDirectoryListing,
  looksLikeDsStore,
  looksLikeEnvFile,
  looksLikeGitConfig,
  looksLikeGitHead,
  looksLikeHtml,
  looksLikeServerStatus,
  looksLikeSqlite,
  looksLikeSvnEntries,
} from '../../../src/lib/exposure/detect.js';

const SPA =
  '<!doctype html><html lang="en"><head><title>app</title></head><body><div id="root"></div></body></html>';

describe('looksLikeHtml', () => {
  it('detects a doctype page', () => {
    expect(looksLikeHtml(SPA)).toBe(true);
  });

  it('detects a page starting with <html', () => {
    expect(looksLikeHtml('<html><body>hi</body></html>')).toBe(true);
  });

  it('detects a page with a head or body tag after whitespace', () => {
    expect(looksLikeHtml('\n  <head><title>x</title></head>')).toBe(true);
  });

  it('does not treat XML as HTML', () => {
    expect(looksLikeHtml('<?xml version="1.0"?><root/>')).toBe(false);
  });

  it('does not treat plain text as HTML', () => {
    expect(looksLikeHtml('KEY=value\nOTHER=1')).toBe(false);
  });
});

describe('looksLikeGitHead', () => {
  it('accepts a symbolic ref', () => {
    expect(looksLikeGitHead('ref: refs/heads/master\n')).toBe(true);
  });

  it('accepts a detached commit id', () => {
    expect(looksLikeGitHead('0123456789abcdef0123456789abcdef01234567')).toBe(
      true,
    );
  });

  it('rejects a bare ref: with no path', () => {
    expect(looksLikeGitHead('ref:')).toBe(false);
  });

  it('rejects an HTML page', () => {
    expect(looksLikeGitHead(SPA)).toBe(false);
  });

  it('rejects a short hex string', () => {
    expect(looksLikeGitHead('0123abc')).toBe(false);
  });
});

describe('looksLikeGitConfig', () => {
  it('accepts a real git config', () => {
    expect(
      looksLikeGitConfig(
        '[core]\n\trepositoryformatversion = 0\n\tbare = false\n',
      ),
    ).toBe(true);
  });

  it('rejects an INI file without the git key', () => {
    expect(looksLikeGitConfig('[core]\nname = other\n')).toBe(false);
  });

  it('rejects an HTML page', () => {
    expect(looksLikeGitConfig(SPA)).toBe(false);
  });
});

describe('looksLikeEnvFile', () => {
  it('accepts a dotenv with KEY=VALUE', () => {
    expect(
      looksLikeEnvFile('# comment\nDB_PASSWORD=secret\nAPI_KEY=abc\n'),
    ).toBe(true);
  });

  it('accepts an exported assignment', () => {
    expect(looksLikeEnvFile('export TOKEN=xyz\n')).toBe(true);
  });

  it('rejects a comment-only file', () => {
    expect(looksLikeEnvFile('# nothing here\n\n')).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(looksLikeEnvFile('')).toBe(false);
  });

  it('rejects an HTML page returned by a SPA', () => {
    expect(looksLikeEnvFile(SPA)).toBe(false);
  });
});

describe('looksLikeSvnEntries', () => {
  it('accepts a legacy entries file', () => {
    expect(looksLikeSvnEntries('12\n\ndir\n...\n')).toBe(true);
  });

  it('accepts an entries file mentioning an svn property', () => {
    expect(looksLikeSvnEntries('10\nsvn:special\n')).toBe(true);
  });

  it('rejects when the first line is not a version integer', () => {
    expect(looksLikeSvnEntries('hello\ndir\n')).toBe(false);
  });

  it('rejects an HTML page', () => {
    expect(looksLikeSvnEntries(SPA)).toBe(false);
  });
});

describe('looksLikeSqlite', () => {
  it('accepts the SQLite magic', () => {
    expect(looksLikeSqlite('SQLite format 3\u0000rest')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(looksLikeSqlite('not a database')).toBe(false);
  });
});

describe('looksLikeDsStore', () => {
  it('accepts the .DS_Store signature', () => {
    expect(looksLikeDsStore('\u0000\u0000\u0000\u0001Bud1 more bytes')).toBe(
      true,
    );
  });

  it('rejects a wrong magic', () => {
    expect(looksLikeDsStore('\u0000\u0000\u0000\u0001XXXX')).toBe(false);
  });

  it('rejects an HTML page', () => {
    expect(looksLikeDsStore(SPA)).toBe(false);
  });

  it('rejects a too-short body', () => {
    expect(looksLikeDsStore('\u0000\u0000')).toBe(false);
  });
});

describe('looksLikeDirectoryListing', () => {
  it('accepts an Apache index title', () => {
    expect(
      looksLikeDirectoryListing('<html><head><title>Index of /uploads</title>'),
    ).toBe(true);
  });

  it('accepts an h1 Index of heading', () => {
    expect(looksLikeDirectoryListing('<body><h1>Index of /images</h1>')).toBe(
      true,
    );
  });

  it('accepts a Python http.server listing', () => {
    expect(
      looksLikeDirectoryListing('<title>Directory listing for /files/</title>'),
    ).toBe(true);
  });

  it('rejects an ordinary page', () => {
    expect(looksLikeDirectoryListing(SPA)).toBe(false);
  });
});

describe('isExposedSourceMap', () => {
  it('accepts a v3 map with sources and mappings', () => {
    const map = JSON.stringify({
      version: 3,
      sources: ['src/app.ts'],
      sourcesContent: ['const a = 1;'],
      mappings: 'AAAA',
    });
    expect(isExposedSourceMap(map)).toBe(true);
  });

  it('rejects a map with no sources', () => {
    expect(
      isExposedSourceMap(
        JSON.stringify({ version: 3, sources: [], mappings: '' }),
      ),
    ).toBe(false);
  });

  it('rejects a wrong version', () => {
    expect(
      isExposedSourceMap(
        JSON.stringify({ version: 2, sources: ['a'], mappings: 'A' }),
      ),
    ).toBe(false);
  });

  it('rejects non-JSON (an HTML catch-all page)', () => {
    expect(isExposedSourceMap(SPA)).toBe(false);
  });

  it('rejects unrelated JSON', () => {
    expect(isExposedSourceMap('{"hello":"world"}')).toBe(false);
  });
});

describe('looksLikeServerStatus', () => {
  it('accepts an Apache status heading', () => {
    expect(
      looksLikeServerStatus(
        '<html><h1>Apache Server Status for example.com</h1>',
      ),
    ).toBe(true);
  });

  it('accepts an Apache info heading', () => {
    expect(looksLikeServerStatus('<h1>Apache Server Information</h1>')).toBe(
      true,
    );
  });

  it('accepts the version/uptime pair', () => {
    expect(
      looksLikeServerStatus('Server Version: Apache/2.4\nServer uptime: 1 day'),
    ).toBe(true);
  });

  it('rejects an ordinary page', () => {
    expect(looksLikeServerStatus(SPA)).toBe(false);
  });
});

describe('isPermissiveCrossdomain', () => {
  it('accepts a wildcard policy', () => {
    expect(
      isPermissiveCrossdomain(
        '<?xml version="1.0"?><cross-domain-policy><allow-access-from domain="*"/></cross-domain-policy>',
      ),
    ).toBe(true);
  });

  it('rejects a restrictive policy', () => {
    expect(
      isPermissiveCrossdomain(
        '<cross-domain-policy><allow-access-from domain="example.com"/></cross-domain-policy>',
      ),
    ).toBe(false);
  });

  it('rejects an HTML page without the policy root', () => {
    expect(
      isPermissiveCrossdomain('<html><body>domain="*"</body></html>'),
    ).toBe(false);
  });
});

describe('confirmsBackup', () => {
  it('confirms a PHP .bak with an open tag', () => {
    expect(confirmsBackup('/index.php.bak', '<?php echo 1; ?>')).toBe(true);
  });

  it('confirms a PHP swap file with a short echo tag', () => {
    expect(confirmsBackup('/config.php~', '<?= $secret ?>')).toBe(true);
  });

  it('confirms an .htaccess backup with a directive', () => {
    expect(confirmsBackup('/.htaccess.bak', 'RewriteEngine On\n')).toBe(true);
  });

  it('confirms a zip archive by magic', () => {
    expect(confirmsBackup('/backup.zip', 'PK\u0003\u0004rest')).toBe(true);
  });

  it('rejects a catch-all HTML page for a PHP backup', () => {
    expect(confirmsBackup('/index.php.bak', SPA)).toBe(false);
  });

  it('rejects a non-zip body for the archive', () => {
    expect(confirmsBackup('/backup.zip', 'not a zip')).toBe(false);
  });

  it('exposes a small, documented probe list', () => {
    expect(BACKUP_PROBES.length).toBeLessThanOrEqual(6);
    expect(BACKUP_PROBES.map((p) => p.path)).toContain('/backup.zip');
  });
});
