export default {
  ignoreDependencies: [/^@semantic-release\//],
  // The sibling apps' shared shell marks what it exports for other apps with
  // `@public`, as in their own knip config.
  tags: ['+public'],
  workspaces: {
    'packages/web': {
      // As in the sibling apps: OpenNext reads its config by name when it
      // builds the Worker, and the scan worker is started by URL, not imported.
      entry: ['open-next.config.ts', 'src/domain/scan/worker.ts'],
      ignore: ['public/**'],
      // Knip reads the `cloudflare:workers` import as a package called
      // `cloudflare`; it is a Workers runtime built-in.
      ignoreDependencies: ['cloudflare'],
    },
    'packages/lighthouse': {
      // Each audit module is loaded by Lighthouse through the plugin manifest
      // rather than imported statically, so they are declared as entries to
      // stop knip reporting them as unused.
      entry: ['src/audits/*.ts'],
    },
    'packages/docker': {
      // webhint resolves the puppeteer connector and the HTML parser from
      // node_modules by name (`'puppeteer'`, `'html'`) at scan time, not
      // through a static import, so knip cannot see that they are used.
      ignoreDependencies: ['@hint/connector-puppeteer', '@hint/parser-html'],
    },
  },
};
