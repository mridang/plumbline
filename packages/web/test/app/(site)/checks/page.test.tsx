import { describe, expect, it } from '@jest/globals';

import ChecksPage, { metadata } from '@/app/(site)/checks/page';
import { CHECKS, SECTIONS } from '@/domain/checks/catalogue';
import { htmlAt } from '../../../components/render';

describe('the checks page', () => {
  const out = htmlAt(<ChecksPage />, { pathname: '/checks' });

  it('may be indexed and says what it lists', () => {
    expect(metadata.title).toBe('Checks');
    expect(metadata.alternates?.canonical).toContain('/checks');
  });

  it('counts the checks in its introduction', () => {
    expect(out).toContain(`>${CHECKS.length}</span> checks in`);
  });

  it('has an area for each section with checks, linked from the top', () => {
    for (const section of SECTIONS) {
      if (CHECKS.some((check) => check.section === section.id)) {
        expect(out).toContain(`href="#${section.id}"`);
        expect(out).toContain(`id="${section.id}"`);
      }
    }
  });

  it('lists every check with its id, which a rules file uses', () => {
    for (const check of CHECKS.slice(0, 20)) {
      expect(out).toContain(`>${check.id}</code>`);
    }
  });

  it('scrolls its tables inside their own boxes', () => {
    expect(out).toContain('overflow-x-auto');
  });
});
