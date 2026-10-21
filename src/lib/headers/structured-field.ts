/**
 * A small reader for the one shape the Cross-Origin-*-Policy headers use: an
 * RFC 8941 structured field item whose bare item is a token, optionally
 * followed by parameters such as `report-to="endpoint"`.
 *
 * Mirrors how Mozilla Observatory (`parseStructuredFieldToken`) and the HTML
 * standard treat these headers: a value that is not a valid item, or whose
 * bare item is not a token (for example a quoted string), is ignored rather
 * than partly honoured.
 */

const TOKEN = /^[A-Za-z*][A-Za-z0-9:/!#$%&'*+.^_`|~-]*$/;
const PARAMETER_KEY = /^[a-z*][a-z0-9_.*-]*$/;
const PARAMETER_VALUE =
  /^(?:\?[01]|-?\d+(?:\.\d+)?|"(?:[^"\\]|\\["\\])*"|[A-Za-z*][A-Za-z0-9:/!#$%&'*+.^_`|~-]*)$/;

/** Returns the token of a structured field item, or null when invalid. */
export function parseStructuredToken(value: string): string | null {
  const [item = '', ...parameters] = value.trim().split(';');
  const token = item.trim();
  if (!TOKEN.test(token)) {
    return null;
  }
  for (const parameter of parameters) {
    const [key = '', ...rest] = parameter.trim().split('=');
    if (!PARAMETER_KEY.test(key)) {
      return null;
    }
    if (rest.length > 0 && !PARAMETER_VALUE.test(rest.join('='))) {
      return null;
    }
  }
  return token;
}
