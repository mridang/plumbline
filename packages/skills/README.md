# @mridang/plumbline-skills

Agent skills that audit a website with the [plumbline CLI](../cli/readme.md) and explain how to fix what fails, packaged both in the open [Agent Skills](https://agentskills.io) format and as a [Claude Code plugin](https://docs.claude.com/en/docs/claude-code/plugins). They work in Claude Code, Codex, Cursor, GitHub Copilot and any other agent that reads `SKILL.md` folders.

| Skill or command                                 | What it does                                                                                                                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`plumbline`](skills/plumbline/SKILL.md)         | Teaches the agent to scan a site with `npx @mridang/plumbline`, read the JSON findings by severity, narrow a re-scan to the checks being fixed, and report each problem with the exact header or record to fix. |
| [`/plumbline:audit`](commands/audit.md) (plugin) | A Claude Code command: `/plumbline:audit example.com` runs the scan and answers with a table of what to fix.                                                                                                    |

The agent ends up running the CLI, so it needs Node 22 or later and a Chrome-family browser. Add `--no-sandbox` when it runs as root or in a container.

## Install the skill

With the [`skills`](https://www.npmjs.com/package/skills) installer, which finds the skill in this repository and puts it where your agent reads skills:

```sh
npx skills add mridang/plumbline
```

Or copy or link the folder yourself:

```sh
# Claude Code, for every project
ln -s "$PWD/packages/skills/skills/plumbline" ~/.claude/skills/plumbline

# Claude Code, for one project
mkdir -p .claude/skills && cp -R packages/skills/skills/plumbline .claude/skills/

# GitHub Copilot, for one repository
mkdir -p .github/skills && cp -R packages/skills/skills/plumbline .github/skills/
```

In Claude Cowork or claude.ai, upload the `plumbline` folder (zipped) as a custom skill.

## Install the Claude Code plugin

The repository is a plugin marketplace (`.claude-plugin/marketplace.json` at its root), and this package is its one plugin. In Claude Code:

```text
/plugin marketplace add mridang/plumbline
/plugin install plumbline@plumbline
```

That installs the skill and the `/plumbline:audit` command. The command asks to run `npx @mridang/plumbline` and nothing else.

## Use it

Ask in plain words, for example "audit the security headers of example.com", "is our TLS and email setup right?" or "why does our site fail Observatory?". The skill scans, groups the findings, leads with errors, and gives the fix for each. For a CI gate rather than an audit, see the [CLI](../cli/readme.md#in-ci).

Without a local browser, connect the agent to the plumbline MCP server instead, at `https://plumbline.apps.mrida.ng/mcp` (see [`packages/web`](../web/README.md)).

## Layout

```text
packages/skills/
├── .claude-plugin/plugin.json   the Claude Code plugin manifest
├── commands/audit.md            /plumbline:audit
└── skills/plumbline/SKILL.md    the skill
```

A new skill is a new folder under `skills/` whose `SKILL.md` front matter has a `name` equal to the folder and a `description` that says when to use it. `test/plugin.test.ts` checks that, the plugin manifest and the marketplace entry.

## Development

```sh
devbox run -- npx jest --coverage=false packages/skills
devbox run -- npx prettier --write packages/skills
```

## Licence

Apache-2.0
