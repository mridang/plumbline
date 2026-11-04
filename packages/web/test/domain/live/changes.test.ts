import { describe, expect, it } from '@jest/globals';

import { describeChange, problemsIn } from '@/domain/live/changes';

const counts = (errors: number, warnings = 0) => ({
  errors,
  warnings,
  hints: 0,
});

describe('problemsIn', () => {
  it('counts errors and warnings, not hints', () => {
    expect(problemsIn({ errors: 2, warnings: 3, hints: 9 })).toBe(5);
  });
});

describe('describeChange', () => {
  it('says a site that did not answer', () => {
    expect(describeChange('a.test', counts(0), null)?.title).toBe(
      'a.test did not answer',
    );
  });

  it('says nothing about a first check that found no errors', () => {
    expect(describeChange('a.test', null, counts(0, 4))).toBeNull();
  });

  it('says a first check that found errors', () => {
    expect(describeChange('a.test', null, counts(2, 1))?.title).toBe(
      'a.test is broken',
    );
  });

  it('says a site broke, with the number it had before', () => {
    const message = describeChange('a.test', counts(0, 2), counts(3, 2));
    expect(message?.title).toBe('a.test is broken');
    expect(message?.body).toBe('Now 5 problems, 3 of them errors (was 2).');
  });

  it('says a site was fixed', () => {
    const message = describeChange('a.test', counts(2), counts(0, 1));
    expect(message?.title).toBe('a.test is fixed');
    expect(message?.body).toContain('1 problem left (was 2)');
  });

  it('says the number of problems changed while it stayed broken', () => {
    const message = describeChange('a.test', counts(2), counts(5));
    expect(message?.title).toBe('a.test changed');
    expect(message?.body).toBe('Now 5 problems (was 2).');
  });

  it('says nothing when the number is the same', () => {
    expect(describeChange('a.test', counts(2, 1), counts(1, 2))).toBeNull();
  });
});
