import type { HintDefinition } from '../../core/define-hint.js';
import exposedBackupFiles from './exposed-backup-files.js';
import exposedCrossdomain from './exposed-crossdomain.js';
import exposedDirectoryListing from './exposed-directory-listing.js';
import exposedDsStore from './exposed-ds-store.js';
import exposedEnv from './exposed-env.js';
import exposedGit from './exposed-git.js';
import exposedServerStatus from './exposed-server-status.js';
import exposedSourceMap from './exposed-source-map.js';
import exposedSvn from './exposed-svn.js';

/**
 * Hints of the `exposure` set: each probes a specific path and reports an
 * error when a sensitive file, directory or admin interface is reachable.
 */
export const exposureHints: readonly HintDefinition[] = [
  exposedGit,
  exposedEnv,
  exposedSvn,
  exposedDsStore,
  exposedDirectoryListing,
  exposedBackupFiles,
  exposedSourceMap,
  exposedServerStatus,
  exposedCrossdomain,
];
