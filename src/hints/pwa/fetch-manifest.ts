import type { Site } from '../../core/page.js';
import { Severity } from '@hint/utils-types';
import { getManifestHref, type DocumentLike } from '../../lib/pwa/read.js';

/** The fetched manifest: its resolved URL, raw body and response media type. */
export interface FetchedManifest {
  url: string;
  text: string;
  mediaType: string;
}

/**
 * Resolves the manifest link captured from the page, fetches it from the site
 * and returns its body and media type. Returns null when the page links no
 * manifest (the `manifest-linked` hint owns that case, so the manifest hints
 * stay quiet) and reports a fetch failure against the manifest URL otherwise.
 *
 * Both manifest hints (`manifest-valid`, `manifest-icons`) fetch through this,
 * so the discovery, resolution and failure handling live in one place.
 */
export async function fetchManifest(
  site: Site,
  document: DocumentLike | null,
): Promise<FetchedManifest | null> {
  const href = document ? getManifestHref(document) : null;
  if (href === null) {
    return null;
  }
  const url = new URL(href, site.url).href;
  const data = await site.fetch(url);
  if (!data || data.response.statusCode !== 200) {
    const status = data ? ` (HTTP ${data.response.statusCode})` : '';
    site.report(
      url,
      `The linked Web App Manifest could not be fetched${status}.`,
      {
        severity: Severity.error,
      },
    );
    return null;
  }
  return {
    url,
    text: data.response.body.content,
    mediaType: data.response.mediaType,
  };
}
