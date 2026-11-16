/**
 * Pure judgement functions for the `exposure` set. Each hint fetches a
 * specific path and asks one of these functions whether the response body
 * really is the sensitive artifact it probed for. Keeping the judgement here,
 * away from webhint types, lets every edge case be unit-tested without a scan.
 *
 * The functions all guard against the single most common false positive: a
 * single-page app (or a catch-all router) that answers 200 with its
 * `index.html` for every unknown path. An HTML shell is never a `.git`
 * directory, a `.env` file or a source map, so each check confirms the body
 * has the shape of the real artifact before it is treated as exposed.
 *
 * The checks follow the OWASP Web Security Testing Guide (WSTG), chiefly
 * WSTG-CONF-04 (Review Old Backup and Unreferenced Files), WSTG-CONF-05
 * (Enumerate Infrastructure and Application Admin Interfaces) and
 * WSTG-CONF-06 (Test HTTP Methods) alongside the source-code-disclosure and
 * configuration-management tests.
 */

/** Matches a line break, with or without a carriage return. */
const LINE_BREAK = /\r?\n/;

/** Matches a symbolic `ref: refs/...` line of a git HEAD file. */
const GIT_HEAD_REF = /^ref:\s+refs\/\S+/;

/** Matches a 40 character hexadecimal git commit id. */
const GIT_COMMIT_ID = /^[0-9a-f]{40}$/i;

/** Matches the `[core]` section header of a git config. */
const GIT_CONFIG_CORE_SECTION = /\[core\]/i;

/** Matches the `repositoryformatversion` setting of a git config. */
const GIT_REPOSITORY_FORMAT_VERSION = /repositoryformatversion\s*=/i;

/** Matches a dotenv `KEY=` assignment, with an optional `export`. */
const ENV_ASSIGNMENT = /^(export\s+)?[A-Za-z_]\w*=/;

/** Matches a short integer, as in the first line of `.svn/entries`. */
const FORMAT_VERSION_LINE = /^\d{1,3}$/;

/** Matches the `dir` token of a working-copy layout. */
const SVN_DIR_TOKEN = /\bdir\b/;

/** Matches an `Index of /` page title. */
const TITLE_INDEX_OF = /<title>\s*Index of \//i;

/** Matches an `Index of /` page heading. */
const HEADING_INDEX_OF = /<h1>\s*Index of \//i;

/** Matches a `Directory listing for /` heading. */
const DIRECTORY_LISTING_FOR = /Directory listing for \//i;

/** Matches the title of the Apache server status page. */
const APACHE_SERVER_STATUS = /Apache Server Status/i;

/** Matches the title of the Apache server information page. */
const APACHE_SERVER_INFORMATION = /Apache Server Information/i;

/** Matches the `Server Version:` line of a status page. */
const SERVER_VERSION_LABEL = /Server Version:/i;

/** Matches the `Server uptime:` line of a status page. */
const SERVER_UPTIME_LABEL = /Server uptime:/i;

/** Matches the `cross-domain-policy` root element. */
const CROSS_DOMAIN_POLICY_ROOT = /<cross-domain-policy/i;

/** Matches an `allow-access-from` element that allows every domain. */
const ALLOW_ACCESS_FROM_ANY_DOMAIN =
  /<allow-access-from\b[^>]*\bdomain\s*=\s*["']\*["']/i;

/** Matches a path that ends in `.zip`. */
const ZIP_EXTENSION = /\.zip$/i;

/** Matches a path that ends in `.php.bak` or `.php~`. */
const PHP_BACKUP_EXTENSION = /\.php(\.bak|~)$/i;

/** Matches a PHP opening tag. */
const PHP_OPEN_TAG = /<\?php\b/;

/** Matches a path that ends in `.htaccess.bak`. */
const HTACCESS_BACKUP_EXTENSION = /\.htaccess\.bak$/i;

/** Matches a line that starts with a common Apache per-directory directive. */
const APACHE_DIRECTIVE_LINE =
  /^[ \t]*(RewriteEngine|RewriteRule|Options|AuthType|Require|Order|Deny|Allow|ErrorDocument|<Files|<Directory|AddHandler|DirectoryIndex)\b/im;

/**
 * True when the body is, at a glance, an HTML document. Used to reject the
 * SPA/catch-all `index.html` that many servers return for unknown paths.
 */
export function looksLikeHtml(content: string): boolean {
  const head = content.slice(0, 2048).trimStart().toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    return true;
  }
  // An XML document (such as crossdomain.xml) is not HTML even though it, too,
  // starts with an angle bracket.
  if (head.startsWith('<?xml')) {
    return false;
  }
  return (
    head.includes('<head') ||
    head.includes('<body') ||
    head.includes('<!doctype')
  );
}

/**
 * A `.git/HEAD` file is a single symbolic ref line, for example
 * `ref: refs/heads/master`, or (on a detached head) a bare 40-character
 * hexadecimal commit id. Anything else — including an HTML page — is not a
 * git HEAD.
 */
export function looksLikeGitHead(content: string): boolean {
  const first = content.split(LINE_BREAK, 1)[0]?.trim() ?? '';
  if (first.startsWith('ref:')) {
    return GIT_HEAD_REF.test(first);
  }
  return GIT_COMMIT_ID.test(first);
}

/**
 * A `.git/config` is an INI file whose `[core]` section always carries
 * `repositoryformatversion`. Requiring both the section header and that key
 * keeps a stray INI file from being mistaken for a git config.
 */
export function looksLikeGitConfig(content: string): boolean {
  const text = content.slice(0, 4096);
  return (
    GIT_CONFIG_CORE_SECTION.test(text) &&
    GIT_REPOSITORY_FORMAT_VERSION.test(text)
  );
}

/**
 * A `.env` file is a list of `KEY=VALUE` assignments, where keys are upper
 * snake-case (`DB_PASSWORD=...`). At least one such line, and no HTML, marks
 * a genuinely exposed environment file. A comment-only or blank body does
 * not count, so an empty 200 is not flagged.
 */
export function looksLikeEnvFile(content: string): boolean {
  if (looksLikeHtml(content)) {
    return false;
  }
  const lines = content.split(LINE_BREAK);
  return lines.some((line) => {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      return false;
    }
    // Keys are letters, digits and underscores, must start with a letter or
    // underscore, and are conventionally upper case in dotenv files.
    return ENV_ASSIGNMENT.test(trimmed);
  });
}

/**
 * Subversion stores working-copy metadata either as a legacy text
 * `.svn/entries` file (whose first line is a format-version integer) or, in
 * modern clients, as a `.svn/wc.db` SQLite database. Either confirms an
 * exposed `.svn` directory.
 */
export function looksLikeSvnEntries(content: string): boolean {
  const first = content.split(LINE_BREAK, 1)[0]?.trim() ?? '';
  // A format-version line is a small integer; the body then mentions the
  // working-copy layout (`dir`) or an `svn:` property. An HTML page has
  // neither a numeric first line nor those tokens.
  if (!FORMAT_VERSION_LINE.test(first)) {
    return false;
  }
  return SVN_DIR_TOKEN.test(content) || content.includes('svn:');
}

/**
 * A SQLite database (such as `.svn/wc.db` or many app databases) begins with
 * the fixed 16-byte magic string `SQLite format 3\0`.
 */
export function looksLikeSqlite(content: string): boolean {
  return content.startsWith('SQLite format 3\u0000');
}

/**
 * A `.DS_Store` file starts with the four-byte big-endian value `0x00000001`
 * followed by the `Bud1` magic. Matching the signature avoids flagging a
 * 200 that returned HTML or an empty body.
 */
export function looksLikeDsStore(content: string): boolean {
  return (
    content.length >= 8 &&
    content.startsWith('\u0000\u0000\u0000\u0001') &&
    content.slice(4, 8) === 'Bud1'
  );
}

/**
 * An automatic directory listing (Apache `mod_autoindex`, nginx `autoindex`,
 * Python's `http.server`) is recognisable by its heading. Apache and nginx
 * emit `Index of /...`; Python emits `Directory listing for /...`.
 */
export function looksLikeDirectoryListing(content: string): boolean {
  const text = content.slice(0, 4096);
  return (
    TITLE_INDEX_OF.test(text) ||
    HEADING_INDEX_OF.test(text) ||
    DIRECTORY_LISTING_FOR.test(text)
  );
}

/**
 * A JavaScript source map is JSON with `"version": 3`. When it also carries a
 * populated `sources` array (and ideally `sourcesContent`) it exposes the
 * original, pre-minification source, which is the real disclosure. A 200 that
 * returns HTML, or JSON of some other shape, is not a source map.
 */
export function isExposedSourceMap(content: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return false;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return false;
  }
  const map = parsed as Record<string, unknown>;
  if (map.version !== 3) {
    return false;
  }
  const sources = map.sources;
  // A source map with no sources exposes nothing useful; require at least one
  // original file path (the `mappings` string is always present in a real
  // map, so demand it too).
  return (
    Array.isArray(sources) &&
    sources.length > 0 &&
    typeof map.mappings === 'string'
  );
}

/**
 * Apache's `mod_status` renders `/server-status` and `/server-info` as HTML
 * whose heading is `Apache Server Status` / `Apache Server Information`.
 * Matching that heading avoids flagging an ordinary HTML page that happens to
 * sit at the path.
 */
export function looksLikeServerStatus(content: string): boolean {
  const text = content.slice(0, 8192);
  return (
    APACHE_SERVER_STATUS.test(text) ||
    APACHE_SERVER_INFORMATION.test(text) ||
    // The status page always prints the server build and current time.
    (SERVER_VERSION_LABEL.test(text) && SERVER_UPTIME_LABEL.test(text))
  );
}

/**
 * A `crossdomain.xml` policy is overly permissive when it grants Flash/other
 * clients access from any origin: an `allow-access-from` whose `domain` is
 * `*`. The body must be a real cross-domain policy, not an HTML page, so the
 * `cross-domain-policy` root element is required.
 */
export function isPermissiveCrossdomain(content: string): boolean {
  const text = content.slice(0, 8192);
  if (!CROSS_DOMAIN_POLICY_ROOT.test(text)) {
    return false;
  }
  return ALLOW_ACCESS_FROM_ANY_DOMAIN.test(text);
}

/** The small, curated list of backup paths each hint probes. */
export interface BackupProbe {
  /** Path on the site, for example `/index.php.bak`. */
  path: string;
  /** What the path is, for the report message. */
  label: string;
}

/**
 * The backup files to probe. The list is deliberately short: one common
 * server-side source backup, one Apache config backup, one archive and one
 * editor swap file. Each one, if reachable with confirming content, leaks
 * source or configuration (WSTG-CONF-04).
 */
export const BACKUP_PROBES: readonly BackupProbe[] = [
  { path: '/index.php.bak', label: 'a PHP source backup' },
  { path: '/.htaccess.bak', label: 'an Apache configuration backup' },
  { path: '/backup.zip', label: 'a site archive' },
  { path: '/config.php~', label: 'an editor backup of a PHP config file' },
];

/**
 * Confirms that a fetched backup path really returned the backup artifact and
 * not a catch-all HTML page. The judgement depends on the kind of file:
 * PHP backups must contain PHP open tags, the `.htaccess` backup must contain
 * an Apache directive, and the archive must start with the ZIP magic.
 */
export function confirmsBackup(path: string, content: string): boolean {
  if (looksLikeHtml(content)) {
    return false;
  }
  if (ZIP_EXTENSION.test(path)) {
    // ZIP local-file header (`PK\x03\x04`) or empty-archive marker.
    return (
      content.startsWith('PK\u0003\u0004') ||
      content.startsWith('PK\u0005\u0006')
    );
  }
  if (PHP_BACKUP_EXTENSION.test(path)) {
    return PHP_OPEN_TAG.test(content) || content.includes('<?=');
  }
  if (HTACCESS_BACKUP_EXTENSION.test(path)) {
    // Any one of the common Apache per-directory directives.
    return APACHE_DIRECTIVE_LINE.test(content);
  }
  return false;
}
