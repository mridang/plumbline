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

const TOKEN = /^[A-Za-z*][A-Za-z0-9:/!#$%&'*+.^_`|~-]*$/u;
const PARAMETER_KEY = /^[a-z*][a-z0-9_.*-]*$/u;
/** The bare item shapes a parameter value may take: boolean, number, string, token. */
const PARAMETER_VALUES = [
  /^\?[01]$/u,
  /^-?\d+(?:\.\d+)?$/u,
  /^"(?:[^"\\]|\\["\\])*"$/u,
  TOKEN,
];

/** Returns the token of a structured field item, or null when invalid. */
export function parseStructuredToken(value: string): string | null {
  const [item = '', ...parameters] = value.trim().split(';');
  const token = item.trim();
  if (!TOKEN.test(token)) {
    return null;
  }
  const validParameters = parameters.every((parameter) => {
    const [key = '', ...rest] = parameter.trim().split('=');
    const parameterValue = rest.join('=');
    return (
      PARAMETER_KEY.test(key) &&
      (rest.length === 0 ||
        PARAMETER_VALUES.some((pattern) => pattern.test(parameterValue)))
    );
  });
  return validParameters ? token : null;
}
