/**
 * WebFinger (RFC 7033) discovers information about people or accounts at a
 * domain, at `/.well-known/webfinger`. It is the lookup the Fediverse uses to
 * resolve `@user@host` handles. A conforming endpoint requires a `resource`
 * query parameter and answers a bare request with `400`; a `200` must carry a
 * JSON Resource Descriptor (JRD). The check reports the endpoint's shape when
 * present and is silent when it is absent (WebFinger is optional).
 *
 * Source: RFC 7033 (https://www.rfc-editor.org/rfc/rfc7033).
 */
import { finding } from '../headers/finding.js';
import { isObject } from '../wellknown/json.js';
import type { Finding } from '../headers/finding.js';

/** Matches a JRD or JSON media type. */
const JRD_CONTENT_TYPE = /application\/jrd\+json|application\/json/iu;

/** The response observed when probing the endpoint without a `resource`. */
export interface WebfingerResponse {
  statusCode: number;
  mediaType: string;
  /** The response body (only meaningful on a `200`). */
  body: string;
}

/**
 * Evaluates a probe of `/.well-known/webfinger` made without a `resource`
 * parameter.
 */
export function webfingerFindings(
  response: WebfingerResponse | null,
): Finding[] {
  if (response === null || response.statusCode === 404) {
    return [];
  }
  // RFC 7033 §4.2: `resource` is required, so a conforming endpoint rejects a
  // bare request with 400. That proves the endpoint exists and is well-behaved.
  if (response.statusCode === 400) {
    return [
      finding(
        'hint',
        'A WebFinger endpoint is present at /.well-known/webfinger (it requires a resource parameter, as RFC 7033 expects).',
      ),
    ];
  }
  if (response.statusCode !== 200) {
    return [];
  }
  // A 200 to a resource-less request must still be a JRD; validate the type
  // and that the body parses as a JRD object (subject and/or links).
  if (!JRD_CONTENT_TYPE.test(response.mediaType)) {
    return [
      finding(
        'warning',
        `The WebFinger endpoint must serve 'application/jrd+json', not '${response.mediaType}'.`,
      ),
    ];
  }
  // eslint-disable-next-line functional/no-let -- assigned inside try/catch so a JSON parse error can return a finding
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    return [finding('warning', 'The WebFinger response is not valid JSON.')];
  }
  if (!isObject(parsed)) {
    return [finding('warning', 'The WebFinger response must be a JRD object.')];
  }
  const jrd = parsed;
  if (!('subject' in jrd) && !('links' in jrd)) {
    return [
      finding(
        'warning',
        "The WebFinger JRD should carry a 'subject' or 'links' member.",
      ),
    ];
  }
  return [
    finding(
      'hint',
      'A WebFinger endpoint responds with a JSON Resource Descriptor.',
    ),
  ];
}
