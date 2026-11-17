import type { HttpHeaders } from '@hint/utils-types';

/** Reads a header case-insensitively and returns it trimmed, or null. */
export function headerValue(
  headers: HttpHeaders | undefined,
  name: string,
): string | null {
  if (!headers) {
    return null;
  }
  const wanted = name.toLowerCase();
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === wanted,
  );
  if (!match) {
    return null;
  }
  const [, value] = match;
  return (Array.isArray(value) ? value.join(', ') : String(value)).trim();
}

/** Renders `Name: value` for use as a report snippet. */
export function headerSnippet(name: string, value: string): string {
  return `${name}: ${value}`;
}
