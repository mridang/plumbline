import { describe, expect, it } from '@jest/globals';
import { notApplicable, productFromFindings } from '../src/result.js';
import type { Finding } from '@mridang/webhint-hint-plumbline/dist/lib/headers/finding.js';

const error: Finding = { severity: 'error', message: 'boom' };
const warning: Finding = { severity: 'warning', message: 'careful' };
const hint: Finding = { severity: 'hint', message: 'fyi' };

describe('productFromFindings (numeric)', () => {
  it('passes with score 1 and no details when there are no findings', () => {
    const product = productFromFindings([]);
    expect(product.score).toBe(1);
    expect(product.scoreDisplayMode).toBe('numeric');
    expect(product.details).toBeUndefined();
  });

  it('fails with score 0 when any finding is an error', () => {
    const product = productFromFindings([warning, error]);
    expect(product.score).toBe(0);
    expect(product.details).toBeDefined();
  });

  it('scores advice (only warnings or hints) at 0.5', () => {
    expect(productFromFindings([warning]).score).toBe(0.5);
    expect(productFromFindings([hint]).score).toBe(0.5);
  });

  it('leads the summary with the worst finding', () => {
    expect(productFromFindings([hint, error]).displayValue).toBe('boom');
  });
});

describe('productFromFindings (binary)', () => {
  it('passes with score 1 when there are no findings', () => {
    expect(productFromFindings([], 'binary').score).toBe(1);
  });

  it('fails with score 0 on any finding, even advice', () => {
    expect(productFromFindings([warning], 'binary').score).toBe(0);
  });
});

describe('productFromFindings (informative)', () => {
  it('never scores and shows no details when empty', () => {
    const product = productFromFindings([], 'informative');
    expect(product.score).toBeNull();
    expect(product.scoreDisplayMode).toBe('informative');
    expect(product.details).toBeUndefined();
  });

  it('surfaces findings without scoring when there are some', () => {
    const product = productFromFindings([error], 'informative');
    expect(product.score).toBeNull();
    expect(product.scoreDisplayMode).toBe('informative');
    expect(product.displayValue).toBe('boom');
    expect(product.details).toBeDefined();
  });
});

describe('notApplicable', () => {
  it('is greyed out and excluded from scoring', () => {
    const product = notApplicable();
    expect(product.score).toBeNull();
    expect(product.scoreDisplayMode).toBe('notApplicable');
    expect(product.notApplicable).toBe(true);
  });
});
