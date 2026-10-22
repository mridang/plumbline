import { readFileSync, globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
);

// Expand the `workspaces` globs to the package.json of every workspace, so the
// release carries no hard-coded package names or paths and stays reusable in
// any npm-workspaces monorepo. `@semantic-release/npm` only understands a
// single `pkgRoot`, so a lockstep release instead drives the native npm
// workspace commands through `@semantic-release/exec`: one version bump and one
// publish fan out to every workspace, and the committed assets are discovered
// the same dynamic way.
const workspacePackageJsons = (packageJson.workspaces ?? [])
  .flatMap((pattern) => globSync(`${pattern}/package.json`, { cwd: here }))
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
