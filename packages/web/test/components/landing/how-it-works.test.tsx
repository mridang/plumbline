import { describe, expect, it } from '@jest/globals';

import { HowItWorks, STEPS } from '@/components/landing/how-it-works';
import { html } from '../render';

describe('HowItWorks', () => {
  const out = html(<HowItWorks />);

  it('tells the three steps in order, numbered', () => {
    expect(STEPS).toHaveLength(3);
    STEPS.forEach((step, index) => {
      expect(out).toContain(`>${step.title}</h3>`);
      expect(out).toContain(`0${index + 1}`);
    });
  });

  it('lists the steps as an ordered list', () => {
    expect(out).toContain('<ol');
  });
});
