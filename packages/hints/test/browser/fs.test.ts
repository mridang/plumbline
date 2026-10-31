import { describe, expect, it } from '@jest/globals';

import { join, mkdtemp, rm, tmpdir, writeFile } from '../../src/browser/fs.js';
import { takeRefusals } from '../../src/browser/refusals.js';

describe('the browser file system', () => {
  it.each([
    ['mkdtemp', mkdtemp],
    ['writeFile', writeFile],
    ['rm', rm],
  ])('refuses %s, noting a file', async (_name, work) => {
    takeRefusals();
    await expect(work()).rejects.toThrow('A browser cannot write a file.');
    expect([...takeRefusals()]).toEqual(['file']);
  });

  it('has no temporary folder, and joins with slashes', () => {
    expect(tmpdir()).toBe('');
    expect(join('a', 'b', 'c.pem')).toBe('a/b/c.pem');
  });
});
