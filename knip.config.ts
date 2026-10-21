export default {
  entry: ['formatter/src/index.ts'],
  ignore: ['knip.config.ts'],
  ignoreDependencies: [/^@semantic-release\//],
  ignoreBinaries: ['openssl'],
};
