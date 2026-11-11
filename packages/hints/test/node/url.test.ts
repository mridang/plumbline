import { describe, expect, it } from '@jest/globals';
import { domainToASCII as nodeDomainToASCII } from 'node:url';

import { domainToASCII } from '../../src/node/url.js';

describe('#url under Node', () => {
  it('is Node own domainToASCII', () => {
    expect(domainToASCII).toBeDefined();
    expect(domainToASCII).toBe(nodeDomainToASCII);
  });
});
