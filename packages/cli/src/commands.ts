/**
 * The commands `plumbline` has, for oclif's explicit command strategy (see
 * `oclif.commands` in `package.json`): listing them here instead of letting
 * oclif scan a folder keeps start-up fast and the build simple.
 */
import Checks from './commands/checks.js';
import Scan from './commands/scan.js';

export const COMMANDS = {
  scan: Scan,
  checks: Checks,
};
