/**
 * Contract test for every registered audit: a check may only read the
 * artifacts it declares in `requiredArtifacts`. We build an artifacts object
 * holding exactly those (with representative stub values) and assert `run()`
 * completes without throwing. This catches a check that reaches for an
 * artifact it did not declare — e.g. Reading `artifacts.URL.finalDisplayedUrl`
 * while declaring only `MainDocumentContent`, which crashes at runtime but is
 * invisible to the per-check unit tests that pass inputs in directly.
 */
import { describe, expect, it } from '@jest/globals';
import { checks } from '../../src/checks/index.js';

/** A representative value for each artifact a check may declare. */
function stubArtifact(name: string): unknown {
  switch (name) {
    case 'MainDocumentContent': {
      return '<!doctype html><html lang="en"><head><title>Test page title here</title></head><body><h1>Heading</h1><p>Body text that is long enough to count as content.</p></body></html>';
    }
    case 'URL': {
      return {
        requestedUrl: 'https://example.test/',
        mainDocumentUrl: 'https://example.test/',
        finalDisplayedUrl: 'https://example.test/',
      };
    }
    case 'MetaElements':
    case 'LinkElements':
    case 'ImageElements': {
      return [];
    }
    case 'DevtoolsLog':
    case 'devtoolsLogs': {
      return [];
    }
    default: {
      return {};
    }
  }
}

/** The minimal artifacts object a check is entitled to read. */
function artifactsFor(required: readonly string[]): Record<string, unknown> {
  const artifacts: Record<string, unknown> = {};
  for (const name of required) {
    artifacts[name] = stubArtifact(name);
  }
  return artifacts;
}

describe('audit artifact contract', () => {
  it('registers 143 checks', () => {
    expect(checks).toHaveLength(143);
  });

  it.each(checks.map((check) => [check.id, check] as const))(
    '%s reads only the artifacts it declares',
    async (_id, check) => {
      const artifacts = artifactsFor(check.requiredArtifacts);
      // A fresh computed-artifact cache, as Lighthouse passes to every audit.
      const context = { computedCache: new Map() };
      // Must not throw: the check may return findings or null, either is fine.
      await expect(
        (async () => check.run(artifacts as never, context as never))(),
      ).resolves.not.toThrow();
    },
  );
});
