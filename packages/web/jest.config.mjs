import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';

/**
 * Paths that git itself treats as ignored, as regex-ready strings.
 *
 * ESLint (`includeIgnoreFile`) and Prettier (`--ignore-path`) read
 * `.gitignore` on their own, but Jest has no such option: it crawls every
 * directory under `rootDir`. Agent worktrees live in `.claude/worktrees/`
 * inside the checkout, so without this Jest treats each of those full repo
 * copies as source and runs every suite once per copy. Asking git for its
 * ignore list gives the same answer as `.gitignore` (nested files, negations,
 * `.git/info/exclude` and the global ignore file) without parsing anything.
 *
 * Falls back to a fixed list when git is unavailable or reports nothing, so
 * a checkout without `.git` still works.
 *
 * @returns {Promise<string[]>} paths relative to this directory.
 */
const gitIgnoredPaths = async () => {
  const fallback = ['.claude/', 'node_modules/', 'dist/'];
  try {
    const { stdout } = await promisify(execFile)(
      'git',
      [
        'ls-files',
        '--others',
        '--ignored',
        '--exclude-standard',
        '--directory',
      ],
      { cwd: new URL('.', import.meta.url) },
    );
    const paths = stdout.split('\n').filter(Boolean);
    return paths.length > 0 ? paths : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Escapes a path for use in a regex and anchors it to Jest's `<rootDir>`.
 * Directories (trailing slash) match everything below them; files must match
 * exactly.
 *
 * @param {string} ignored a path reported by git, relative to the repo root.
 * @returns {string} an anchored regex string.
 */
const toPattern = (ignored) => {
  const escaped = ignored.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return ['<rootDir>/', escaped, ignored.endsWith('/') ? '' : '$'].join('');
};

/**
 * Returns the path when the file exists next to this config, otherwise
 * `undefined`, so a repository only needs a global setup or teardown when it
 * has something to set up or tear down.
 *
 * @param {string} file path relative to this directory.
 * @returns {Promise<string | undefined>} the path, or `undefined`.
 */
const ifPresent = async (file) => {
  try {
    await access(new URL(file, import.meta.url));
    return file;
  } catch {
    return undefined;
  }
};

const ignoredPaths = await gitIgnoredPaths();
const ignoredPatterns = ignoredPaths.map((ignored) => toPattern(ignored));

export default {
  preset: 'ts-jest/presets/default-esm',
  transform: {
    '^.+\\.m?[tj]sx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.jest.json',
      },
    ],
  },
  testEnvironment: 'node',
  testMatch: ['**/*.+(spec|test).[tj]s?(x)'],
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'mjs',
    'jsx',
    'mts',
    'json',
    'node',
  ],
  testPathIgnorePatterns: ignoredPatterns,
  modulePathIgnorePatterns: ignoredPatterns,
  resetModules: false,
  globalSetup: await ifPresent('./test/setup.ts'),
  globalTeardown: await ifPresent('./test/teardown.ts'),
  collectCoverage: true,
  coverageDirectory: './.out',
  collectCoverageFrom: ['src/**/*.{ts,tsx,js,jsx}', '!src/**/*.d.ts'],
  coverageReporters: ['lcov', 'text'],
  testTimeout: 60_000,
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.mts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // The app's `@/` alias for src/, so components and pages can be tested.
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './.out',
        outputName: 'junit.xml',
      },
    ],
  ],
};
