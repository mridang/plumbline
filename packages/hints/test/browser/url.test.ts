import { describe, expect, it } from '@jest/globals';

import { domainToASCII } from '../../src/browser/url.js';

describe('domainToASCII', () => {
  it.each([
    ['example.com', 'example.com'],
    ['Bücher.example', 'xn--bcher-kva.example'],
    ['a b', ''],
  ])('turns %s into %s, as Node does', (domain, ascii) => {
    expect(domainToASCII(domain)).toBe(ascii);
  });
});
