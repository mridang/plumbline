import { readdir } from 'node:fs/promises';

/** Options Jest accepts only at the top level, never inside a project. */
const GLOBAL_ONLY = new Set(['reporters', 'coverageReporters']);

/**
 * Loads every workspace package's own Jest config as a Jest project.
 *
 * Each package keeps the standard, identical `jest.config.mjs`, so it can also
 * run on its own from its directory. Jest rejects the reporter options inside
 * a project, so they are dropped here and set once for the whole run below.
 *
 * @returns {Promise<object[]>} one Jest project per package that has a config.
 */
const packageProjects = async () => {
  const packages = await readdir(new URL('packages/', import.meta.url));
  const loaded = await Promise.all(
    packages.map(async (name) => {
      try {
        // eslint-disable-next-line no-unsanitized/method -- name comes from this repository's own packages directory
        const { default: config } = await import(
          `./packages/${name}/jest.config.mjs`
        );
        const project = Object.fromEntries(
          Object.entries(config).filter(([key]) => !GLOBAL_ONLY.has(key)),
        );
        return { ...project, rootDir: `<rootDir>/packages/${name}` };
      } catch {
        return undefined;
      }
    }),
  );
  return loaded.filter(Boolean);
};

export default {
  projects: await packageProjects(),
  collectCoverage: true,
  coverageDirectory: './.out',
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx,js,jsx}',
    '!packages/web/**',
    '!**/*.d.ts',
  ],
  coverageReporters: ['lcov', 'text'],
  testTimeout: 60_000,
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
