import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
  // eslint-disable-next-line n/no-sync -- sync is fine in a config file read once at load
  readFileSync(new URL('package.json', import.meta.url), 'utf8'),
);

const packages = ['cli', 'formatter', 'hints', 'lighthouse', 'skills'];

export default {
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ...packages.map((name) => [
      '@semantic-release/npm',
      {
        npmPublish: true,
        pkgRoot: `packages/${name}`,
        tarballDir: '.',
        access: 'public',
      },
    ]),
    [
      '@mridang/semantic-release-oci',
      {
        dockerRegistry: 'docker.io',
        dockerProject: 'mridang',
        dockerImage: 'plumbline',
        dockerTags: ['latest', '{{major}}', '{{version}}'],
        dockerTimeout: 3_600_000,
        dockerBake: {
          file: 'docker-bake.hcl',
          group: 'release',
          imageTarget: 'image',
        },
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [{ path: '*.tgz', label: 'Package' }],
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          ...packages.map((name) => `packages/${name}/package.json`),
          'package-lock.json',
        ],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
  repositoryUrl: packageJson.repository.url,
};
