import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';
import { packageDirectorySync } from 'package-directory';

/** Matches the button pointer cursor rule. */
const BUTTON_POINTER_RULE =
  /(button:not\(:disabled\),[^{]*)\{\s*cursor: pointer;/u;
/** Matches a bare button selector. */
const BARE_BUTTON_SELECTOR = /(^|,)\s*button,/u;

const PACKAGE = packageDirectorySync({ cwd: import.meta.dirname })!;

const css = await readFile(
  path.join(PACKAGE, 'src', 'app', 'globals.css'),
  'utf8',
);

describe('globals.css', () => {
  describe('cursor', () => {
    const rule = BUTTON_POINTER_RULE.exec(css)?.[1];

    it('is the pointer for anything clickable, since Tailwind 4 no longer gives buttons one', () => {
      for (const selector of [
        'button:not(:disabled)',
        'summary',
        'select:not(:disabled)',
      ]) {
        expect(rule).toContain(selector);
      }
      expect(rule).toContain("[role='button']");
    });

    it('is left alone for disabled controls', () => {
      expect(rule).not.toMatch(BARE_BUTTON_SELECTOR);
      expect(rule).toContain(':not(:disabled)');
    });
  });
});
