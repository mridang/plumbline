// The Node module `#path` stands for (see `imports` in package.json): browsers
// get the stand-in in `src/browser/` instead, which has the same shape.
import path from 'node:path';

export declare const join: typeof path.join;
