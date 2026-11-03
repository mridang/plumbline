import { globSync, readFileSync } from 'fs';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
);

const workspacePackageJsons = (packageJson.workspaces ?? [])
  .flatMap((pattern) => globSync(`${pattern}/package.json`))
  .sort();

export default {
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/exec',
      {
        prepareCmd:
          'npm version ${nextRelease.version} --workspaces --no-git-tag-version --allow-same-version',
        publishCmd: 'npm publish --workspaces --access public',
      },
    ],
    [
      '@mridang/semantic-release-oci',
      {
        dockerRegistry: 'docker.io',
        dockerProject: 'mridang',
        dockerImage: 'plumbline',
        dockerTags: ['latest', '{{major}}', '{{version}}'],
        dockerTimeout: 3600000,
        dockerBake: {
          file: 'docker-bake.hcl',
          group: 'release',
          imageTarget: 'image',
        },
      },
    ],
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: [...workspacePackageJsons, 'package-lock.json'],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
  repositoryUrl: packageJson.repository.url,
};
