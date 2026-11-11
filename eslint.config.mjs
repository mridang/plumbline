import { includeIgnoreFile } from '@eslint/compat';
import { fileURLToPath } from 'node:url';
import mridangPlugin from '@mridang/eslint-defaults';

export default [
  includeIgnoreFile(fileURLToPath(new URL('.gitignore', import.meta.url))),
  {
    // The web app is a sibling of the Next-on-Workers apps and is linted by
    // its own eslint.config.mjs, the same as theirs.
    ignores: ['packages/web/**'],
  },
  ...mridangPlugin.configs.recommended,
  {
    // Large data or adapter file kept as one module.
    files: [
      'packages/hints/src/core/origins.ts',
      'packages/hints/src/core/taxonomy-data.ts',
    ],
    rules: { 'sonarjs/max-lines': 'off' },
  },
];
