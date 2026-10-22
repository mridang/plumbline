export default {
  ignoreDependencies: [/^@semantic-release\//],
  workspaces: {
    'packages/lighthouse': {
      // Each audit module is loaded by Lighthouse through the plugin manifest
      // rather than imported statically, so they are declared as entries to
      // stop knip reporting them as unused.
      entry: ['src/audits/*.ts'],
    },
  },
};
