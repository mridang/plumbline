import { DEFAULT_OUT } from './args.js';

/** The text `plumbline --help` prints. */
export const HELP = `plumbline: audit a website with every webhint-hints check

Usage:
  plumbline scan <url-or-domain> [options]
  plumbline checks [--group <group,...>] [--format text|json]
  plumbline --help
  plumbline --version

Scan options:
  -f, --format <text|json|html>  How to print the findings (default: text).
                                 json prints an array of
                                 {hint, severity, message, resource, codeSnippet}.
                                 html writes <site>.html and <site>.json to --out.
      --only <id,...>            Run only these checks.
      --skip <id,...>            Leave these checks out.
  -g, --group <group,...>        Run only the checks in these groups
                                 (for example owasp, tls, dns, email, seo, agent).
      --fail-on <level>          error, warning or none: exit 1 when a finding is
                                 at or above this severity (default: error).
  -o, --out <dir>                Where --format html writes (default: ${DEFAULT_OUT}).
      --browser <path>           The Chrome or Chromium to drive; found
                                 automatically when left out.
      --no-sandbox               Run Chromium without its sandbox (needed as root
                                 or in most containers).

Checks options:
  -g, --group <group,...>        List only the checks in these groups.
  -f, --format <text|json>       How to print the list (default: text).

A bare domain is scanned over HTTPS. Options that take a list accept commas or
can be repeated. Exit status: 0 ok, 1 findings at or above --fail-on,
2 a usage mistake, 3 the scan could not run.

The checks run in real Node, so the TLS, mail and socket checks work. The same
checks run in a browser at https://plumbline.apps.mrida.ng.
`;
