# @mridang/plumbline

`plumbline` audits a website with every [webhint-hints](../hints/README.md) check: security headers, TLS, DNS, email, Open Graph and SEO, privacy, agent readiness and the well-known files. It runs the checks in real Node with a real Chrome, so the checks that open TLS connections, talk to mail servers or resolve DNS all run. The same checks run in a browser at [plumbline.apps.mrida.ng](https://plumbline.apps.mrida.ng), where those are skipped.

## Install

```sh
npx @mridang/plumbline scan example.com
```

or install it once with `npm install --global @mridang/plumbline` and run `plumbline`. Node 22 or later is needed, and a Chrome, Chromium, Edge or Brave install. The browser is found in the usual places or through `CHROME_PATH` or `PUPPETEER_EXECUTABLE_PATH`; pass `--browser <path>` to choose one.

## Scan a site

```sh
plumbline scan example.com
plumbline scan https://example.com/blog --format json
plumbline scan example.com --group tls,email --fail-on warning
plumbline scan example.com --only csp,hsts
plumbline scan example.com --skip tls-version
plumbline scan example.com --format html --out reports
```

A bare domain is scanned over HTTPS. The text report lists each check with findings, most serious first, with every finding's severity, message and evidence. `--format json` prints an array of `{ hint, severity, message, resource, codeSnippet }` on stdout (progress goes to stderr, so it can be piped). `--format html` writes `<site>.html`, the report from `@mridang/webhint-formatter-extra`, and `<site>.json` into `--out` (default `hint-report`).

Severities are webhint's: `error` for a failed rule, `warning` for advice and `hint` for information. `--fail-on` sets the lowest one that fails the run: `error` (the default), `warning` or `none`.

Run it as root or in a container with `--no-sandbox`, since Chromium's sandbox does not work there.

## List the checks

```sh
plumbline checks
plumbline checks --group email
plumbline checks --format json
```

Each check has an id (what `--only` and `--skip` take), a name, a description and its groups. The same list, with each check's section and source, is the [hints table](../hints/README.md#hints). Groups name the source a check came from (`observatory`, `owasp`, `webbkoll`, `internetnl`, `mdn`, …) and its topic (`security-headers`, `tls`, `dns`, `privacy`, `seo`, `social`, `email`, `agent`, `pwa`).

## Exit status

| Status | Meaning                                                         |
| ------ | --------------------------------------------------------------- |
| 0      | Nothing at or above `--fail-on`.                                |
| 1      | A finding at or above `--fail-on`.                              |
| 2      | A mistake on the command line (unknown option, check or group). |
| 3      | The scan could not run (no browser found, site unreachable, …). |

## In CI

`scan` exits 1 when a finding is at or above `--fail-on`, so it can gate a job. A step that fails on a broken security header of a staging site, in a container:

```sh
npx @mridang/plumbline scan https://staging.example.com/ --group security-headers --no-sandbox
```

## With an agent

The [plumbline agent skill](../../skills/plumbline/SKILL.md) teaches a coding agent to run this CLI, read the findings and explain the fixes:

```sh
npx skills add mridang/webhint-hints
```

## Use it from code

The package also exports the scan the CLI runs, which the Docker scan server shares:

```js
import { buildReport, scan } from '@mridang/plumbline';

const result = await scan('https://example.com/', { hints: ['csp', 'hsts'] });
const report = buildReport('https://example.com/', result, '1.0.0');
```

`scan` takes the URL and, optionally, `hints` (bare ids), `executablePath` (the browser) and `browserArgs` (Chromium launch arguments). `saveReport` writes the JSON and HTML reports to a directory, and `hintCatalogue` lists the checks.

## Development

Commands run from the repository root through devbox. The CLI imports the compiled hints and formatter packages, so build first:

```sh
devbox run -- npm run build
devbox run -- npx jest --coverage=false packages/cli
devbox run -- npx eslint packages/cli
devbox run -- node packages/cli/dist/cli.js scan example.com   # the local build
```

## Licence

Apache-2.0
