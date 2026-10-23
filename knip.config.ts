export default {
  ignoreDependencies: [/^@semantic-release\//],
  workspaces: {
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
