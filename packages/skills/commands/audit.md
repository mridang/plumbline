---
description: Audit a website with every plumbline check and explain how to fix what fails
argument-hint: <url-or-domain> [--group <groups>] [--only <ids>]
allowed-tools: Bash(npx @mridang/plumbline:*)
---

Audit $ARGUMENTS with the plumbline CLI, following the `plumbline` skill.

1. Run the scan and keep the findings as JSON (progress goes to stderr):

   ```sh
   npx @mridang/plumbline scan $ARGUMENTS --format json --fail-on none
   ```

   If it exits with status 3 because no Chrome was found, say so and suggest
   `--browser <path>`, or `--no-sandbox` when running as root or in a container.

2. Group the findings by `hint`, errors first, then warnings. Leave `hint`
   severity findings out of the failures.

3. Answer with a short table: the check, what is wrong, and the fix, using the
   finding's `codeSnippet` for the exact header, tag or record to change. Offer
   to re-run only the checks the user is fixing with `--only`.
