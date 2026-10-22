import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import type * as LH from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { pwaChecks } from '../../src/checks/pwa.js';
import type { AuditCheck } from '../../src/checks/types.js';
// The single-source rules the webhint hints call. The Lighthouse check runs the
// same functions through its own HTML parse, so the findings must match these
// exactly, proving the check and the hint cannot diverge.
import {
  manifestLinked,
  themeColorMeta,
} from '@mridang/webhint-hint-extra/dist/lib/pwa/checks.js';
import type { DocumentLike } from '@mridang/webhint-hint-extra/dist/lib/pwa/read.js';

const require = createRequire(import.meta.url);
const { createHTMLDocument } = require('@hint/utils-dom');

const parse = (html: string): DocumentLike =>
  createHTMLDocument(html, 'https://x.test/') as DocumentLike;

/** Builds the artifacts a PWA check reads: the raw HTML and the page URL. */
function artifacts(html: string): LH.Artifacts {
  return {
    MainDocumentContent: html,
    URL: {
      mainDocumentUrl: 'https://x.test/',
      finalDisplayedUrl: 'https://x.test/',
    },
  } as unknown as LH.Artifacts;
}

const context = {} as AuditNS.Context;

const byId = (id: string): AuditCheck => {
  const check = pwaChecks.find((c) => c.id === id);
  if (!check) {
    throw new Error(`no check ${id}`);
  }
  return check;
};

describe('pwaChecks', () => {
  it('exposes only the two DOM checks, with their scoring modes', () => {
    expect(pwaChecks.map((c) => c.id)).toEqual([
      'manifest-linked',
      'theme-color-meta',
    ]);
    expect(byId('manifest-linked').scoreMode).toBe('numeric');
    expect(byId('theme-color-meta').scoreMode).toBe('informative');
  });

  it('borrows the title, description and section from the webhint hint', () => {
    const check = byId('manifest-linked');
    expect(check.title).toBe('Page links a Web App Manifest');
    expect(check.section).toBe('pwa');
    expect(check.reference).toContain('w3.org');
  });

  it('manifest-linked matches the shared rule for a missing link', async () => {
    const html = '<html lang="en"><head><title>t</title></head></html>';
    const findings = await byId('manifest-linked').run(
      artifacts(html),
      context,
    );
    expect(findings).toEqual(manifestLinked(parse(html)));
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('manifest-linked passes an absolute link', async () => {
    const html =
      '<html lang="en"><head><link rel="manifest" href="/m.webmanifest"></head></html>';
    expect(await byId('manifest-linked').run(artifacts(html), context)).toEqual(
      [],
    );
  });

  it('theme-color-meta matches the shared rule when the meta is missing', async () => {
    const html = '<html lang="en"><head><title>t</title></head></html>';
    const findings = await byId('theme-color-meta').run(
      artifacts(html),
      context,
    );
    expect(findings).toEqual(themeColorMeta(parse(html)));
    expect(findings?.[0]?.severity).toBe('hint');
  });

  it('returns null when the HTML artifact is absent', async () => {
    expect(
      await byId('manifest-linked').run(artifacts(''), context),
    ).toBeNull();
  });
});
