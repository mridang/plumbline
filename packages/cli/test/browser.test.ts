import { describe, expect, it } from '@jest/globals';
import { findBrowser } from '../src/browser.js';

/** A lookup where only the listed files exist. */
function lookup(
  platform: typeof process.platform,
  files: string[],
  env: Record<string, string | undefined> = {},
) {
  return { platform, env, exists: (file: string) => files.includes(file) };
}

describe('findBrowser', () => {
  it('prefers CHROME_PATH', () => {
    expect(
      findBrowser(
        lookup('linux', ['/usr/bin/chromium'], {
          CHROME_PATH: '/opt/chrome',
          PUPPETEER_EXECUTABLE_PATH: '/opt/puppeteer',
        }),
      ),
    ).toBe('/opt/chrome');
  });

  it('falls back to PUPPETEER_EXECUTABLE_PATH', () => {
    expect(
      findBrowser(
        lookup('linux', [], { PUPPETEER_EXECUTABLE_PATH: '/opt/puppeteer' }),
      ),
    ).toBe('/opt/puppeteer');
  });

  it('finds Chrome in /Applications on macOS', () => {
    const chrome =
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    expect(findBrowser(lookup('darwin', [chrome]))).toBe(chrome);
  });

  it('finds a browser in the user Applications folder on macOS', () => {
    const chromium =
      '/Users/a/Applications/Chromium.app/Contents/MacOS/Chromium';
    expect(
      findBrowser(lookup('darwin', [chromium], { HOME: '/Users/a' })),
    ).toBe(chromium);
  });

  it('prefers Chrome over Chromium on Linux', () => {
    expect(
      findBrowser(
        lookup('linux', ['/usr/bin/chromium', '/usr/bin/google-chrome']),
      ),
    ).toBe('/usr/bin/google-chrome');
  });

  it('finds Edge under Program Files on Windows', () => {
    const edge = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
    expect(
      findBrowser(
        lookup('win32', [edge], { PROGRAMFILES: 'C:\\Program Files' }),
      ),
    ).toBe(edge);
  });

  it('leaves the search to the connector when nothing is installed', () => {
    expect(findBrowser(lookup('linux', []))).toBeUndefined();
  });
});
