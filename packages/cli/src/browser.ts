import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Environment variables that name a browser binary, in the order they are
 * honoured. `CHROME_PATH` is what chrome-launcher and Lighthouse read, and
 * `PUPPETEER_EXECUTABLE_PATH` what Puppeteer itself reads, so a machine set
 * up for either tool works with plumbline unchanged.
 */
const ENV_NAMES = ['CHROME_PATH', 'PUPPETEER_EXECUTABLE_PATH'] as const;

/** Where the context for finding a browser comes from; injectable in tests. */
export interface BrowserLookup {
  platform: typeof process.platform;
  env: Record<string, string | undefined>;
  exists: (file: string) => boolean;
}

/** The usual install locations of Chrome, Chromium, Edge and Brave. */
function candidates(
  platform: typeof process.platform,
  env: Record<string, string | undefined>,
): string[] {
  if (platform === 'darwin') {
    const apps = [
      'Google Chrome.app/Contents/MacOS/Google Chrome',
      'Chromium.app/Contents/MacOS/Chromium',
      'Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      'Brave Browser.app/Contents/MacOS/Brave Browser',
    ];
    const roots = [
      '/Applications',
      ...(env.HOME ? [`${env.HOME}/Applications`] : []),
    ];
    return roots.flatMap((root) => apps.map((app) => `${root}/${app}`));
  }
  if (platform === 'win32') {
    const roots = [
      env.LOCALAPPDATA,
      env.PROGRAMFILES,
      env['PROGRAMFILES(X86)'],
    ].filter((root): root is string => !!root);
    const apps = [
      String.raw`Google\Chrome\Application\chrome.exe`,
      String.raw`Chromium\Application\chrome.exe`,
      String.raw`Microsoft\Edge\Application\msedge.exe`,
      String.raw`BraveSoftware\Brave-Browser\Application\brave.exe`,
    ];
    return roots.flatMap((root) =>
      apps.map((app) => path.win32.join(root, app)),
    );
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
    '/usr/bin/brave-browser',
  ];
}

/**
 * Finds a Chrome-family browser to drive when `--browser` is not given: a
 * path from the environment first, then the usual install locations.
 *
 * The puppeteer connector has its own finder, but on current macOS it reads
 * the LaunchServices database in a way that no longer finds Chrome, so the
 * CLI looks in the well-known places itself and only leaves the connector to
 * search when none of them exists.
 * @param lookup - The platform, environment and a file-exists test.
 * @returns The binary to use, or `undefined` to let the connector search.
 */
/** The lookup against the machine this runs on. */
function systemLookup(): BrowserLookup {
  return {
    platform: process.platform,
    env: process.env,
    exists: existsSync,
  };
}

export function findBrowser(
  lookup: BrowserLookup = systemLookup(),
): string | undefined {
  for (const name of ENV_NAMES) {
    const value = lookup.env[name];
    if (value) {
      // An explicit setting is used even when it does not exist, so a wrong
      // path fails with the connector's clear "path is not accessible".
      return value;
    }
  }
  return candidates(lookup.platform, lookup.env).find((file) =>
    lookup.exists(file),
  );
}
