/**
 * `@mridang/plumbline` is a command-line scanner for the `plumbline`
 * checks (the `plumbline` executable). Its scan and report logic is exported
 * too, so the Docker scan server and other programs run exactly the same
 * scan the CLI does.
 */
export { scan, hintCatalogue, allHintIds, hintConfig } from './scan.js';
export type { ScanOptions, ScanResult, HintMeta } from './scan.js';
export { buildReport, saveReport } from './report.js';
export type { Report, Finding, Summary, SavedReport } from './report.js';
export { runScan } from './engine/run-scan.js';
export type { ScanEvent, RunOptions } from './engine/run-scan.js';
export type { HintInfo } from './engine/catalogue.js';
export type {
  HintOutcome,
  Finding as OutcomeFinding,
} from './engine/engine.js';
export { COMMANDS } from './commands.js';
export type { Io, Dependencies } from './run.js';
