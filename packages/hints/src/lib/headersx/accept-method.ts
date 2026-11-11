/**
 * `Accept-Post` and `Accept-Patch` advertise the media types a resource will
 * accept in the body of a POST or PATCH request. Both are comma-separated media
 * type lists; `Accept-Patch` is sent on an `OPTIONS` response (or `405`) to
 * tell a client which PATCH document formats are understood. The checks
 * validate the media-type list when the header is present, following each
 * header's MDN reference page.
 */
import { finding, type Finding } from '../headers/finding.js';
import { splitList } from '../headers/http-headers.js';

/** A media type: `type/subtype` with optional parameters, or `*` wildcards. */
const MEDIA_TYPE = /^(\*|[A-Za-z0-9][\w.+-]*)\/(\*|[A-Za-z0-9][\w.+-]*)$/;

/** True for a media type, ignoring any `;parameter` suffix. */
function isMediaType(value: string): boolean {
  const base = value.split(';', 1)[0]?.trim() ?? '';
  return MEDIA_TYPE.test(base);
}

/** Validates one of the two method-advertising headers. */
function acceptMethodFindings(name: string, value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const types = splitList(value);
  if (types.length === 0) {
    return [finding('warning', `The '${name}' header is empty.`)];
  }
  const invalid = types.filter((type) => !isMediaType(type));
  return invalid.length > 0
    ? [
        finding(
          'warning',
          `The '${name}' header must list media types such as 'application/json', not: ${invalid.join(', ')}.`,
        ),
      ]
    : [];
}

/** `Accept-Post` lists the media types a resource accepts for POST. */
export function acceptPostFindings(value: string | null): Finding[] {
  return acceptMethodFindings('Accept-Post', value);
}

/** `Accept-Patch` lists the media types a resource accepts for PATCH. */
export function acceptPatchFindings(value: string | null): Finding[] {
  return acceptMethodFindings('Accept-Patch', value);
}
