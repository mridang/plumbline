---
name: plumbline
description: Audit a website's security headers, TLS, DNS, email authentication, Open Graph and SEO, privacy, agent readiness and well-known files with the plumbline CLI (`npx @mridang/plumbline`), then explain the findings and how to fix them. Use when the user says things like "audit my site", "check the security headers on example.com", "is our TLS and email setup right", "why does our site fail Observatory", "is this site ready for AI agents", or wants a CI step that fails on website misconfiguration.
---

# Audit a website with plumbline

plumbline runs every plumbline check (about 270, ported from Mozilla
Observatory, OWASP, Webbkoll, internet.nl, MDN and others) against a site and
reports what is wrong, with the evidence. It runs in real Node with a real
Chrome, so the checks that open TLS connections, talk to mail servers and
resolve DNS all run.

## What you need

- **Node 22 or later** and `npx`.
- **A Chrome-family browser** (Chrome, Chromium, Edge or Brave). It is found in
  the usual install locations or through `CHROME_PATH`; otherwise pass
  `--browser <path>`. As root or in a container, add `--no-sandbox`.
- **Network access to the site.** Scanning sends ordinary requests to it and to
  its mail and DNS servers. Only scan sites the user owns or asked about.

## Workflow

### 1. Scan

```sh
npx @mridang/plumbline scan example.com --format json --fail-on none > findings.json
```

A bare domain is scanned over HTTPS; pass a full URL (`http://localhost:3000/`)
for anything else. With `--format json`, stdout holds only a JSON array, one
entry per finding:

```json
[
  {
    "hint": "csp",
    "severity": "error",
    "message": "Content Security Policy (CSP) header not implemented.",
    "resource": "https://example.com/",
    "codeSnippet": "Content-Security-Policy: default-src 'none'; …"
  }
]
```

`codeSnippet` is the evidence (the offending header line, the header to add,
the DNS record, the TLS versions) and is left out when there is none. Progress
goes to stderr. Use `--fail-on none` while auditing so the exit status does not
read as a crash.

### 2. Read the severities

- `error`: a failed rule from the check's source. Fix these first.
- `warning`: advice; worth fixing, rarely urgent.
- `hint`: information, including checks that could not complete ("Could not
  test: …"). Do not report a `hint` as a failure.

### 3. Explain and narrow

Group findings by `hint` and lead with errors. To learn what a check is about,
list the catalogue:

```sh
npx @mridang/plumbline checks --format json            # id, name, groups, description
npx @mridang/plumbline checks --group email
```

Then re-run only what you are working on, for example after the user changes a
header:

```sh
npx @mridang/plumbline scan example.com --only csp,hsts --format json
npx @mridang/plumbline scan example.com --group tls,email --format json
npx @mridang/plumbline scan example.com --skip tls-version
```

Groups are a check's section (`https`, `hardening`, `exposure`, `privacy`,
`dns`, `email`, `seo`, …), a tag (`security`, `tls`, `seo`, …), a target
(`web`, `mail`, `site`) or its source (`observatory`, `owasp`, `webbkoll`,
`internetnl`, `mdn`, …); the old topics (`security-headers`, `social`,
`agent`) still work. `--tier recommended|advanced|experimental` and
`--target web|mail|site` narrow further. An unknown id or group exits with
status 2 and names it; check the spelling with `checks`.

### 4. Report

Give the user a short table of errors and warnings: check, what is wrong, and
the fix (use `codeSnippet` for the exact header or record). For a report they
can keep, write the HTML report:

```sh
npx @mridang/plumbline scan example.com --format html --out hint-report
```

## In CI

`scan` exits 1 when a finding is at or above `--fail-on` (`error` by default,
or `warning`), 2 for a command-line mistake and 3 when the scan could not run
(no browser, site unreachable). A gate on a staging site:

```sh
npx @mridang/plumbline scan https://staging.example.com/ --group security-headers --no-sandbox
```

## Without a local browser

The same checks run in a browser at https://plumbline.apps.mrida.ng, and its MCP
server at https://plumbline.apps.mrida.ng/mcp can be added as a connector. That
version cannot open raw connections, so the TLS, mail and socket checks show as
skipped there; prefer the CLI when it can run.
