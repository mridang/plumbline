import { Args, Flags } from '@oclif/core';

import {
  DEFAULT_OUT,
  FAIL_ON,
  SCAN_FORMATS,
  type ScanCommand,
} from '../options.js';
import { resolveDependencies, runScan } from '../run.js';
import { PlumblineCommand } from './base.js';

/** The flags `plumbline scan` takes. */
export const SCAN_FLAGS = {
  format: Flags.option({
    char: 'f',
    options: SCAN_FORMATS,
    default: 'text',
    summary: 'How to print the findings.',
    description:
      'json prints an array of {hint, severity, message, resource, codeSnippet}; html writes <site>.html and <site>.json to --out.',
  })(),
  only: Flags.string({
    multiple: true,
    multipleNonGreedy: true,
    delimiter: ',',
    summary: 'Run only these checks (ids, comma separated or repeated).',
  }),
  skip: Flags.string({
    multiple: true,
    multipleNonGreedy: true,
    delimiter: ',',
    summary: 'Leave these checks out.',
  }),
  group: Flags.string({
    char: 'g',
    multiple: true,
    multipleNonGreedy: true,
    delimiter: ',',
    summary:
      'Run only the checks in these sections, tags, sources or targets (https, seo, owasp, section:email, tag:tls, …).',
  }),
  tier: Flags.string({
    multiple: true,
    multipleNonGreedy: true,
    delimiter: ',',
    options: ['recommended', 'advanced', 'experimental'],
    summary: 'Run only the checks of these tiers.',
  }),
  target: Flags.string({
    multiple: true,
    multipleNonGreedy: true,
    delimiter: ',',
    options: ['web', 'mail', 'site'],
    summary: 'Run only the checks that look at these targets.',
  }),
  'fail-on': Flags.option({
    options: FAIL_ON,
    default: 'error',
    summary: 'Exit 1 when a finding is at or above this severity.',
  })(),
  out: Flags.string({
    char: 'o',
    default: DEFAULT_OUT,
    summary: 'Where --format html writes its report.',
  }),
  browser: Flags.string({
    summary:
      'The Chrome or Chromium to drive; found automatically when left out.',
  }),
  sandbox: Flags.boolean({
    default: true,
    allowNo: true,
    summary:
      'Keep Chromium’s sandbox; --no-sandbox is needed as root or in most containers.',
  }),
};

/** The command a parsed `plumbline scan` stands for. */
export function scanCommandOf(
  target: string,
  flags: Readonly<{
    format: ScanCommand['format'];
    only?: string[];
    skip?: string[];
    group?: string[];
    tier?: string[];
    target?: string[];
    'fail-on': ScanCommand['failOn'];
    out: string;
    browser?: string;
    sandbox: boolean;
  }>,
): ScanCommand {
  const trimmed = (values: string[] | undefined): string[] =>
    (values ?? []).map((value) => value.trim()).filter(Boolean);
  return {
    kind: 'scan',
    target,
    format: flags.format,
    only: trimmed(flags.only),
    skip: trimmed(flags.skip),
    groups: trimmed(flags.group),
    tiers: trimmed(flags.tier),
    targets: trimmed(flags.target),
    failOn: flags['fail-on'],
    out: flags.out,
    ...(flags.browser === undefined ? {} : { browser: flags.browser }),
    sandbox: flags.sandbox,
  };
}

/**
 * `plumbline scan <url-or-domain>`: run the checks against a site with real
 * Node and a real Chrome, print what they found, and exit 1 when a finding is
 * at or above `--fail-on`.
 */
export default class Scan extends PlumblineCommand {
  static override id = 'scan';

  static override summary = 'Audit a website with every plumbline check.';

  static override description = `A bare domain is scanned over HTTPS. The checks run in real Node with a real Chrome, so the TLS, mail and socket checks work too.

Exit status: 0 ok, 1 findings at or above --fail-on, 2 a usage mistake, 3 the scan could not run.`;

  static override examples = [
    '<%= config.bin %> <%= command.id %> example.com',
    '<%= config.bin %> <%= command.id %> example.com --format json --group tls,email --tier recommended --fail-on warning',
    '<%= config.bin %> <%= command.id %> https://example.com/blog --format html --out reports',
  ];

  static override args = {
    target: Args.string({
      required: true,
      description: 'The URL or domain to scan.',
    }),
  };

  static override flags = SCAN_FLAGS;

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Scan);
    const deps = resolveDependencies(this.dependencies());
    await this.finish(() =>
      runScan(
        scanCommandOf(args.target, flags),
        this.io(),
        deps.catalogue(),
        deps,
      ),
    );
  }
}
