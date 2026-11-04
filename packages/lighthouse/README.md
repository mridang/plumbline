# @mridang/lighthouse-plugin-plumbline

A [Lighthouse](https://developer.chrome.com/docs/lighthouse) plugin that runs the [plumbline](../hints/README.md) checks whose data Lighthouse already gathers: security headers, cookies and CORS, Open Graph and link previews, SEO, hreflang and structured data, privacy and agent discovery.

Each audit reuses the check logic of the matching webhint hint, so it reports the same findings. A Lighthouse plugin cannot add gatherers, so every audit reads only the artifacts Lighthouse collects by default (the DevTools log, the URL, and the page's meta and link elements). Checks that need DNS, TLS, mail servers or other URLs are not here; use the [`plumbline` CLI](../cli/README.md) for those.

The plugin adds one category, "Webhint extra", with 143 audits grouped by the same sections as the hints (Site protection, Search and page quality and so on). Audits whose hint is context-specific are shown but weigh 0 in the score.

## Install

Install it next to Lighthouse 12:

```sh
npm install --save-dev lighthouse @mridang/lighthouse-plugin-plumbline
```

Node 22 or later is needed.

## Use

On the command line:

```sh
npx lighthouse https://example.com/ --plugins=@mridang/lighthouse-plugin-plumbline
npx lighthouse https://example.com/ --plugins=@mridang/lighthouse-plugin-plumbline --only-categories=@mridang/lighthouse-plugin-plumbline
```

Or in a Lighthouse config file:

```js
// lighthouse.config.mjs
export default {
  extends: 'lighthouse:default',
  plugins: ['@mridang/lighthouse-plugin-plumbline'],
};
```

```sh
npx lighthouse https://example.com/ --config-path=./lighthouse.config.mjs
```

The category's id is the plugin name, `@mridang/lighthouse-plugin-plumbline`, and each audit's id is `webhint-<hint id>` (for example `webhint-csp`).

## Development

Commands run from the repository root through devbox. The audits import the compiled hints package, so build first:

```sh
devbox run -- npm run build
devbox run -- npx jest --coverage=false packages/lighthouse
devbox run -- npx eslint packages/lighthouse
```

An audit is a row in the declarative table in `src/checks/`; `src/plugin.ts` builds the manifest from it.

## Licence

Apache-2.0
