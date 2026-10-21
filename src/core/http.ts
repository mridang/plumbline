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
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) {
      return (Array.isArray(value) ? value.join(', ') : String(value)).trim();
    }
  }
  return null;
}

/** Splits a comma separated header or directive list into trimmed parts. */
export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Renders `Name: value` for use as a report snippet. */
export function headerSnippet(name: string, value: string): string {
  return `${name}: ${value}`;
}
