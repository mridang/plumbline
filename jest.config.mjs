export default {
  preset: 'ts-jest/presets/default-esm',
  transform: {
    '^.+\\.m?[tj]sx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.jest.json',
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
  // The web app has its own Jest config (its `@/` alias and JSX), and the
  // root `test` script runs it after this one.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/frontend/',
    '/dist/',
    '/packages/web/',
  ],
  resetModules: false,
  globalSetup: './packages/hints/test/setup.ts',
  globalTeardown: './packages/hints/test/teardown.ts',
  collectCoverage: true,
  coverageDirectory: './.out',
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx,js,jsx}',
    '!packages/web/**',
    '!**/*.d.ts',
  ],
  coverageReporters: ['lcov', 'text'],
  coveragePathIgnorePatterns: ['/dist/', '/node_modules/'],
  testTimeout: 60000,
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.mts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
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
