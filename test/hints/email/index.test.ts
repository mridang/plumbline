import { describe, expect, it } from '@jest/globals';
import { emailHints } from '../../../src/hints/email/index.js';

describe('emailHints', () => {
  it('lists the eight mail hints', () => {
    expect(emailHints.map((hint) => hint.id).sort()).toEqual([
      'mail-dane',
      'mail-dkim',
      'mail-dmarc',
      'mail-dnssec',
      'mail-ipv6',
      'mail-rpki',
      'mail-spf',
      'mail-starttls',
    ]);
  });

  it('puts every hint in the internetnl and email groups', () => {
    for (const hint of emailHints) {
      expect(hint.groups).toEqual(
        expect.arrayContaining(['internetnl', 'email']),
      );
    }
  });
});
