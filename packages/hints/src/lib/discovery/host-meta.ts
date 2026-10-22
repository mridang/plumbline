/**
 * `host-meta` (RFC 6415) describes a host's metadata and the templates for
 * resolving resources under it, at `/.well-known/host-meta`. It is served as an
 * XRD XML document, or as a JRD JSON document at `/.well-known/host-meta.json`.
 * The check validates whichever form is served when the file is present and is
 * silent when it is absent.
 *
 * Source: RFC 6415 (https://www.rfc-editor.org/rfc/rfc6415).
 */
import { finding, type Finding } from '../headers/finding.js';

/** The response observed when fetching the host-meta document. */
export interface HostMetaResponse {
  statusCode: number;
  mediaType: string;
  body: string;
}

/** True when the body is a well-formed-looking XRD document. */
function looksLikeXrd(body: string): boolean {
  return /<\s*XRD(\s|>)/i.test(body);
}

/** Evaluates a fetch of `/.well-known/host-meta` (or its `.json` form). */
export function hostMetaFindings(response: HostMetaResponse | null): Finding[] {
  if (response === null || response.statusCode === 404) {
    return [];
  }
  if (response.statusCode !== 200) {
    return [];
  }
  const type = response.mediaType.toLowerCase();
  // A JRD (JSON) form must parse as an object; the registered type is
  // application/json but hosts commonly serve the `.json` variant.
  if (type.includes('json')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      return [finding('warning', 'The host-meta JRD is not valid JSON.')];
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return [finding('warning', 'The host-meta JRD must be a JSON object.')];
    }
    return [finding('hint', 'A host-meta JRD document is present.')];
  }
  // Otherwise it must be the XRD XML form.
  if (!looksLikeXrd(response.body)) {
    return [
      finding(
        'warning',
        "The host-meta document must be an XRD document (or a JRD served as JSON), not '" +
          response.mediaType +
          "'.",
      ),
    ];
  }
  return [finding('hint', 'A host-meta XRD document is present.')];
}
