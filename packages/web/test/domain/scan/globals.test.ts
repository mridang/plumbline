import { describe, expect, it } from '@jest/globals';
import url from 'node:url';

import '@/domain/scan/globals';

describe('the scan worker globals', () => {
  it('give the hints a global Buffer', () => {
    expect(Buffer.from('hi').toString('base64')).toBe('aGk=');
  });

  it('give the url module a URL class for webhint DOM', () => {
    expect(new url.URL('/a', 'https://example.com/').href).toBe(
      'https://example.com/a',
    );
  });
});
