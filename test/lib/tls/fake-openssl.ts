/**
 * Helpers for tests of the hints that shell out to `openssl`: a fake runner
 * that returns canned `s_client` output, and a check for the real binary.
 */
import { spawnSync } from 'node:child_process';
import { it } from '@jest/globals';
import {
  execOpenssl,
  openssl,
  type OpensslExec,
} from '../../../src/lib/tls/openssl.js';

/** Whether the real `openssl` binary is on the PATH. */
const hasOpenssl = spawnSync('openssl', ['version']).status === 0;

/** `it` when the real binary exists, `it.skip` otherwise. */
export const realIt = hasOpenssl ? it : it.skip;

/** Makes every `openssl` run print `stdout` and `stderr`. */
export function fakeOpenssl(stdout: string, stderr = ''): void {
  const exec: OpensslExec = () => Promise.resolve({ stdout, stderr, code: 0 });
  openssl.exec = exec;
}

/** Makes `openssl` look as if it were not installed. */
export function missingOpenssl(): void {
  openssl.exec = () =>
    Promise.reject(
      Object.assign(new Error('spawn openssl'), { code: 'ENOENT' }),
    );
}

/** Restores the real runner; call it in `afterEach`. */
export function restoreOpenssl(): void {
  openssl.exec = execOpenssl;
  openssl.command = 'openssl';
}
