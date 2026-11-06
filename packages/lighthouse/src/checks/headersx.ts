/**
 * The `headersx` check set: the experimental MDN response-header hints run as
 * Lighthouse audits from the artifacts Lighthouse already gathers. Like the
 * `headers` set, each check reads the main document's response headers (out of
 * the devtools log via the `NetworkRecords` computed artifact), builds the
 * small input the shared `src/lib/headersx/**` function takes, and calls that
 * exact function, so a site yields the same findings here as under the webhint
 * hint.
 *
 * Titles, descriptions, references and sections come from the compiled hint
 * metadata (`../meta.ts`); nothing is restated here. Scoring is `numeric`
 * (graded) for the validity-when-present checks. The two Privacy Sandbox
 * headers (`attribution-reporting`, `observe-browsing-topics`) surface a
 * presence signal even when valid, so they are `informative`: their findings
 * are listed but never scored.
 */
import type { HintDefinition } from '@mridang/webhint-hint-plumbline/dist/core/define-hint.js';
import { firstHeader } from '@mridang/webhint-hint-plumbline/dist/lib/headers/http-headers.js';
import {
  attributionReportingFindings,
  observeBrowsingTopicsFindings,
} from '@mridang/webhint-hint-plumbline/dist/lib/headersx/privacy-apis.js';
import { setLoginFindings } from '@mridang/webhint-hint-plumbline/dist/lib/headersx/fedcm.js';
import { digestFindings } from '@mridang/webhint-hint-plumbline/dist/lib/headersx/digest.js';
import {
  speculationRulesFindings,
  supportsLoadingModeFindings,
} from '@mridang/webhint-hint-plumbline/dist/lib/headersx/speculation.js';
import { compressionDictionaryFindings } from '@mridang/webhint-hint-plumbline/dist/lib/headersx/compression.js';
import { serviceWorkerAllowedFindings } from '@mridang/webhint-hint-plumbline/dist/lib/headersx/service-worker.js';
import {
  acceptPatchFindings,
  acceptPostFindings,
} from '@mridang/webhint-hint-plumbline/dist/lib/headersx/accept-method.js';
import { mainResponse } from '../network.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';

// The compiled webhint hints, imported only for their metadata.
import attributionReportingHint from '@mridang/webhint-hint-plumbline/dist/hints/headersx/attribution-reporting.js';
import observeBrowsingTopicsHint from '@mridang/webhint-hint-plumbline/dist/hints/headersx/observe-browsing-topics.js';
import setLoginHint from '@mridang/webhint-hint-plumbline/dist/hints/headersx/set-login.js';
import contentDigestHint from '@mridang/webhint-hint-plumbline/dist/hints/headersx/content-digest.js';
import reprDigestHint from '@mridang/webhint-hint-plumbline/dist/hints/headersx/repr-digest.js';
import speculationRulesHint from '@mridang/webhint-hint-plumbline/dist/hints/headersx/speculation-rules.js';
import supportsLoadingModeHint from '@mridang/webhint-hint-plumbline/dist/hints/headersx/supports-loading-mode.js';
import useAsDictionaryHint from '@mridang/webhint-hint-plumbline/dist/hints/headersx/use-as-dictionary.js';
import serviceWorkerAllowedHint from '@mridang/webhint-hint-plumbline/dist/hints/headersx/service-worker-allowed.js';
import acceptPostHint from '@mridang/webhint-hint-plumbline/dist/hints/headersx/accept-post.js';
import acceptPatchHint from '@mridang/webhint-hint-plumbline/dist/hints/headersx/accept-patch.js';

/** The artifact set these checks read: the devtools log and the URL set. */
const HEADER_ARTIFACTS = ['DevtoolsLog', 'URL'] as const;

/**
 * Builds a check that borrows its metadata (title, description, reference and
 * section) from a compiled webhint hint, exactly as the `headers` set does.
 */
function fromHint(
  definition: HintDefinition,
  config: Pick<AuditCheck, 'scoreMode' | 'run'>,
): AuditCheck {
  const docs = hintDocs(definition);
  return {
    id: definition.id,
    section: docs.section ?? 'hardening',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode: config.scoreMode,
    requiredArtifacts: HEADER_ARTIFACTS,
    run: config.run,
  };
}

/** The experimental-header checks, in report order. */
export const headersxChecks: readonly AuditCheck[] = [
  // Privacy Sandbox opt-in headers: a presence signal, so informative.
  fromHint(attributionReportingHint, {
    scoreMode: 'informative',
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? attributionReportingFindings(
            firstHeader(main.headers, 'attribution-reporting-register-source'),
            firstHeader(main.headers, 'attribution-reporting-register-trigger'),
          )
        : null;
    },
  }),

  fromHint(observeBrowsingTopicsHint, {
    scoreMode: 'informative',
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? observeBrowsingTopicsFindings(
            firstHeader(main.headers, 'observe-browsing-topics'),
          )
        : null;
    },
  }),

  fromHint(setLoginHint, {
    scoreMode: 'numeric',
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? setLoginFindings(firstHeader(main.headers, 'set-login'))
        : null;
    },
  }),

  fromHint(contentDigestHint, {
    scoreMode: 'numeric',
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? digestFindings(
            'Content-Digest',
            firstHeader(main.headers, 'content-digest'),
          )
        : null;
    },
  }),

  fromHint(reprDigestHint, {
    scoreMode: 'numeric',
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? digestFindings(
            'Repr-Digest',
            firstHeader(main.headers, 'repr-digest'),
          )
        : null;
    },
  }),

  fromHint(speculationRulesHint, {
    scoreMode: 'numeric',
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? speculationRulesFindings(
            firstHeader(main.headers, 'speculation-rules'),
          )
        : null;
    },
  }),

  fromHint(supportsLoadingModeHint, {
    scoreMode: 'numeric',
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? supportsLoadingModeFindings(
            firstHeader(main.headers, 'supports-loading-mode'),
          )
        : null;
    },
  }),

  fromHint(useAsDictionaryHint, {
    scoreMode: 'numeric',
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? compressionDictionaryFindings(
            firstHeader(main.headers, 'use-as-dictionary'),
          )
        : null;
    },
  }),

  fromHint(serviceWorkerAllowedHint, {
    scoreMode: 'numeric',
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? serviceWorkerAllowedFindings(
            firstHeader(main.headers, 'service-worker-allowed'),
          )
        : null;
    },
  }),

  fromHint(acceptPostHint, {
    scoreMode: 'numeric',
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? acceptPostFindings(firstHeader(main.headers, 'accept-post'))
        : null;
    },
  }),

  fromHint(acceptPatchHint, {
    scoreMode: 'numeric',
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? acceptPatchFindings(firstHeader(main.headers, 'accept-patch'))
        : null;
    },
  }),
];
