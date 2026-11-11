# @mridang/webhint-formatter-plumbline

A [webhint](https://webhint.io) formatter that writes one self-contained HTML report for the [plumbline](../hints/README.md) checks.

The stock `html` report only knows webhint's eight categories, never shows a hint's description, and links every hint to `webhint.io` pages that do not exist for these hints. This one sorts hints into the sections stamped on them (see [Sections](../hints/README.md#sections)), and stock hints into their webhint category. Each hint shows its description, a reference link, its origins, its source groups and tagged sections as badges, and its findings with code snippets and further reading. Sections without findings show as passed, and buttons for the sources that occur (`observatory`, `owasp` and so on) filter the report. When the `agent-score` hint ran, its score is shown as a summary card at the top.

The report is a single HTML file with its styles and a little inline JavaScript, makes no external requests, and works in light and dark mode and on a phone.

## Install

```sh
npm install --save-dev hint @mridang/webhint-formatter-plumbline
```

It needs `hint` 7.1 or later as a peer dependency, and Node 22 or later.

## Use

List it in `.hintrc`, next to or instead of the stock formatters:

```json
{
  "formatters": ["stylish", "@mridang/webhint-formatter-plumbline"],
  "extends": [
    "./node_modules/@mridang/webhint-hint-plumbline/configs/observatory.json"
  ]
}
```

```sh
npx hint https://example.com/
```

The report is written to `hint-report/<site>.html` in the current directory (for example `hint-report/https-example-com.html`), and the path is printed when the scan ends.

The [`plumbline` CLI](../cli/readme.md) writes the same report with `plumbline scan example.com --format html`, and the [Docker image](../docker/README.md) writes it when given an output directory.

## Development

Commands run from the repository root through devbox:

```sh
devbox run -- npm run build
devbox run -- npx jest --coverage=false packages/formatter
devbox run -- npx eslint packages/formatter
```

## Licence

Apache-2.0
