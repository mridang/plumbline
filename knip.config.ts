export default {
  ignoreDependencies: [/^@semantic-release\//],
  // The sibling apps' shared shell marks what it exports for other apps with
  // `@public`, as in their own knip config.
  tags: ['+public'],
  workspaces: {
    'packages/web': {
      // As in the sibling apps: OpenNext reads its config by name when it
      // builds the Worker, the scan worker is started by URL, not imported,
      // the MCP views are bundled to standalone pages by build:views, and the
      // build scripts run from npm scripts.
      entry: [
        'open-next.config.ts',
        'src/domain/scan/worker.ts',
        'src/views/report.tsx',
        'src/views/domain-list.tsx',
        'scripts/*.mjs',
      ],
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
  },
};
