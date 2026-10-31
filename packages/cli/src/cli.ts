#!/usr/bin/env node
/**
 * The `plumbline` executable. All the work is in `main`, which returns the
 * exit status instead of exiting, so the process ends on its own once the
 * browser and any open sockets are closed.
 */
import { main } from './main.js';

process.exitCode = await main(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
