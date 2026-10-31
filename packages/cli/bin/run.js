#!/usr/bin/env node
// The `plumbline` executable: oclif reads the commands from `dist/commands.js`
// (see `oclif` in package.json) and runs the one asked for.
import { execute } from '@oclif/core';

await execute({ dir: import.meta.url });
