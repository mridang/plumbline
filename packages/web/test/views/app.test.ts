import { describe, expect, it } from '@jest/globals';

import { APP_STYLES, REQUEST_ARGUMENTS } from '@/views/app';

/** The value of one rule's declaration, such as the padding of `.wrap`. */
function declaration(selector: string, property: string): string {
  const rule = APP_STYLES.match(
    new RegExp(
      String.raw`(?:^|\n)${selector.replace('.', String.raw`\.`)} \{([^}]*)\}`,
    ),
  );
  const value = rule?.[1]?.match(
    new RegExp(String.raw`${property}:\s*([^;]*);`),
  );
  return value?.[1]?.replaceAll(/\s+/g, ' ').trim() ?? '';
}

describe('REQUEST_ARGUMENTS', () => {
  it('names the domain first, then the search', () => {
    expect(REQUEST_ARGUMENTS).toEqual(['domain', 'query']);
  });
});

describe('the report', () => {
  it.each(['failed', 'warned', 'passed'])(
    'gives the %s count its own colour, with a fallback for hosts that send none',
    (status) => {
      expect(APP_STYLES).toMatch(
        new RegExp(
          String.raw`\.tally \.${status}[^{]*\{[^}]*var\(--color-text-\w+, #`,
        ),
      );
    },
  );

  it('colours a failed and a warned status like its count', () => {
    expect(APP_STYLES).toContain('.tally .failed, .status.failed');
    expect(APP_STYLES).toContain('.tally .warned, .status.warned');
  });

  it('wraps long evidence instead of widening the frame', () => {
    expect(declaration('.finding p', 'overflow-wrap')).toBe('anywhere');
    expect(declaration('.finding .where', 'overflow-wrap')).toBe('anywhere');
  });
});
