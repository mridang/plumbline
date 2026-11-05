import { describe, expect, it } from '@jest/globals';

import { BAR_STEPS, CountsBar, stepsOf } from '@/components/ui-app/counts-bar';
import { html } from '../render';

describe('stepsOf', () => {
  it('gives one step to each finding, red first', () => {
    expect(stepsOf(2, 3)).toEqual({ failed: 2, warned: 3 });
  });

  it('fills the bar at ten findings and no further', () => {
    expect(stepsOf(20, 5)).toEqual({ failed: BAR_STEPS, warned: 0 });
    expect(stepsOf(4, 30)).toEqual({ failed: 4, warned: 6 });
  });

  it('is empty for a site with nothing wrong', () => {
    expect(stepsOf(0, 0)).toEqual({ failed: 0, warned: 0 });
  });
});

describe('CountsBar', () => {
  it('says its figures to people who hear the page', () => {
    expect(html(<CountsBar failed={2} warned={1} />)).toContain(
      'aria-label="2 failed, 1 with warnings"',
    );
  });

  it('draws a red and an amber segment of the right width, with no inline style', () => {
    const out = html(<CountsBar failed={2} warned={3} />);
    expect(out).toMatch(/bg-failed w-\[20%\]/);
    expect(out).toMatch(/bg-warned w-\[30%\]/);
    expect(out).not.toContain('style=');
  });

  it('draws only a quiet track when nothing is wrong', () => {
    const out = html(<CountsBar failed={0} warned={0} />);
    expect(out).not.toContain('bg-failed');
    expect(out).not.toContain('bg-warned');
    expect(out).toContain('bg-passed/15');
  });
});
