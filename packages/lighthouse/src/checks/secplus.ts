/**
 * The `secplus` check set: the webhint `secplus` security hints a Lighthouse
 * *plugin* can run from the artifacts Lighthouse already gathers. Each check
 * reshapes those artifacts into the tiny input the shared `src/lib/secplus/**`
 * function already takes, then calls that *same single-source rule function*
 * the webhint hint calls, so a site yields the same findings here as under the
 * hint. The predicate, message and severity therefore live in one place.
 *
 * Covered here (DOM/header only):
 *   - `tabnabbing`         reads the anchors out of `MainDocumentContent`.
 *   - `csp-strength`       reads the CSP header (devtools log) and `<meta>` CSP.
 *   - `cookie-prefixes`    reads the `Set-Cookie` headers (devtools log).
 *   - `form-action-secure` reads the forms out of `MainDocumentContent`.
 *
 * `http-methods` is deliberately absent: it needs an `OPTIONS` request, which a
 * Lighthouse plugin cannot make, so it is webhint-only.
 *
 * Titles, descriptions, references and the section are pulled from the compiled
 * webhint hint metadata (`../meta.ts`), never restated. Every check is
 * `numeric` — each is a real security problem, so it is scored, not advisory.
 */
import { createHTMLDocument } from '@hint/utils-dom';
import type { Artifacts } from 'lighthouse';
import type { HTMLDocument } from '@hint/utils-dom';
import type { HintDefinition } from '@mridang/webhint-hint-plumbline/dist/core/define-hint.js';
import { headerValues } from '@mridang/webhint-hint-plumbline/dist/lib/headers/http-headers.js';
// The single-source secplus rules: predicate + message + severity. Both this
// check and the webhint hints call these, so neither restates the wording.
import {
  tabnabbingFindings,
  type AnchorLike,
} from '@mridang/webhint-hint-plumbline/dist/lib/secplus/tabnabbing.js';
import { evaluateCspStrength } from '@mridang/webhint-hint-plumbline/dist/lib/secplus/csp-strength.js';
import { cookiePrefixFindings } from '@mridang/webhint-hint-plumbline/dist/lib/secplus/cookie-prefixes.js';
import {
  formActionFindings,
  type FormLike,
} from '@mridang/webhint-hint-plumbline/dist/lib/secplus/form-action.js';
import { mainResponse } from '../network.js';
import { cspMetaContents } from '../adapt.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';

// The compiled webhint hints, imported only for their metadata (name,
// description, reference, section); their check logic is reused through the
// `src/lib/secplus/**` functions above, not through these modules.
import tabnabbingHint from '@mridang/webhint-hint-plumbline/dist/hints/secplus/tabnabbing.js';
import cspStrengthHint from '@mridang/webhint-hint-plumbline/dist/hints/secplus/csp-strength.js';
import cookiePrefixesHint from '@mridang/webhint-hint-plumbline/dist/hints/secplus/cookie-prefixes.js';
import formActionSecureHint from '@mridang/webhint-hint-plumbline/dist/hints/secplus/form-action-secure.js';

/** The artifact sets each check reads, named for what reads them. */
const HTML_AND_URL = ['MainDocumentContent', 'URL'] as const;
const HEADER_ARTIFACTS = ['DevtoolsLog', 'URL'] as const;
const HEADER_AND_META_ARTIFACTS = [
  'DevtoolsLog',
  'URL',
  'MetaElements',
] as const;

/** The page URL a DOM check resolves relative hrefs against. */
function pageUrl(artifacts: Artifacts): string {
  return (
    artifacts.URL?.finalDisplayedUrl || artifacts.URL?.mainDocumentUrl || ''
  );
}

/** Parses `MainDocumentContent` with webhint's DOM implementation. */
function parsePage(artifacts: Artifacts): HTMLDocument {
  return createHTMLDocument(
    artifacts.MainDocumentContent ?? '',
    pageUrl(artifacts) || 'http://localhost/',
  );
}

/**
 * Builds a check that borrows its metadata from a compiled webhint hint. The
 * title, description, reference and section are taken from the hint and never
 * restated; the `run` body reuses the shared `src/lib/secplus/**` rule
 * function, so the finding message matches the hint's byte for byte.
 */
function fromHint(
  definition: HintDefinition,
  config: {
    scoreMode: AuditCheck['scoreMode'];
    requiredArtifacts: readonly string[];
    run: AuditCheck['run'];
  },
): AuditCheck {
  const docs = hintDocs(definition);
  return {
    id: definition.id,
    // Every secplus hint is placed in the taxonomy; fall back to site
    // protection defensively rather than emit an empty group.
    section: docs.section ?? 'hardening',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode: config.scoreMode,
    requiredArtifacts: config.requiredArtifacts,
    run: config.run,
  };
}

/** The four plugin-able secplus checks, in the hint set's order. */
export const secplusChecks: readonly AuditCheck[] = [
  // ---- Reverse tabnabbing (DOM) -----------------------------------------
  fromHint(tabnabbingHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HTML_AND_URL,
    run: (artifacts) => {
      if (!artifacts.MainDocumentContent) {
        return null;
      }
      const anchors: AnchorLike[] = [
        ...parsePage(artifacts).querySelectorAll('a[target]'),
      ].map((element) => ({
        target: element.getAttribute('target'),
        rel: element.getAttribute('rel'),
        href: element.getAttribute('href'),
      }));
      return tabnabbingFindings(anchors, pageUrl(artifacts));
    },
  }),

  // ---- CSP depth (header + meta) ----------------------------------------
  fromHint(cspStrengthHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_AND_META_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      const headers = headerValues(main.headers, 'content-security-policy');
      const metas =
        headers.length === 0 ? cspMetaContents(artifacts.MetaElements) : [];
      return evaluateCspStrength([...headers, ...metas]);
    },
  }),

  // ---- Cookie prefixes (header) -----------------------------------------
  fromHint(cookiePrefixesHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      return cookiePrefixFindings(headerValues(main.headers, 'set-cookie'));
    },
  }),

  // ---- Insecure form action (DOM) ---------------------------------------
  fromHint(formActionSecureHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HTML_AND_URL,
    run: (artifacts) => {
      if (!artifacts.MainDocumentContent) {
        return null;
      }
      const forms: FormLike[] = [
        ...parsePage(artifacts).querySelectorAll('form[action]'),
      ].map((element) => ({ action: element.getAttribute('action') }));
      return formActionFindings(forms, pageUrl(artifacts));
    },
  }),
];
