import { describe, expect, it } from '@jest/globals';

import {
  MANUAL_RUN_INTERVAL_SECONDS,
  formatCountdown,
  nextRunAt,
  secondsLeft,
  secondsUntilNextRun,
  waitMessage,
} from '@/domain/scan/manual-run';

const last = '2026-01-01T10:00:00.000Z';
const at = (seconds: number): number => Date.parse(last) + seconds * 1000;

describe('secondsUntilNextRun', () => {
  it('is the whole interval just after a run, and counts down to zero at five minutes', () => {
    expect(MANUAL_RUN_INTERVAL_SECONDS).toBe(300);
    expect(secondsUntilNextRun(last, at(0))).toBe(300);
    expect(secondsUntilNextRun(last, at(1))).toBe(299);
    expect(secondsUntilNextRun(last, at(299))).toBe(1);
    expect(secondsUntilNextRun(last, at(300))).toBe(0);
    expect(secondsUntilNextRun(last, at(86_400))).toBe(0);
  });

  it('counts a part-second as a whole one, so the wait is never cut short', () => {
    expect(secondsUntilNextRun(last, at(0) + 900)).toBe(300);
    expect(secondsUntilNextRun(last, at(299) + 999)).toBe(1);
    expect(secondsUntilNextRun(last, at(300) - 1)).toBe(1);
  });

  it('is zero when the site was never run, or the time is unreadable', () => {
    expect(secondsUntilNextRun(undefined, at(0))).toBe(0);
    expect(secondsUntilNextRun('not a time', at(0))).toBe(0);
  });

  it('never asks for more than the interval, even if the clock reads before the run', () => {
    expect(secondsUntilNextRun(last, at(-3600))).toBe(300);
  });
});

describe('waitMessage', () => {
  it('says how long to wait in minutes and seconds', () => {
    expect(waitMessage(299)).toContain('try again in 4 min 59 s');
    expect(waitMessage(120)).toContain('try again in 2 min.');
    expect(waitMessage(45)).toContain('try again in 45 s.');
  });
});

describe('nextRunAt and secondsLeft', () => {
  it('is five minutes after the last run, or nothing', () => {
    expect(nextRunAt(last)).toBe(at(300));
    expect(nextRunAt(undefined)).toBe(0);
    expect(nextRunAt('not a time')).toBe(0);
  });

  it('counts the seconds left to a moment, from the interval down to zero', () => {
    expect(secondsLeft(at(300), at(0))).toBe(300);
    expect(secondsLeft(at(300), at(240))).toBe(60);
    expect(secondsLeft(at(300), at(300))).toBe(0);
    expect(secondsLeft(at(300), at(400))).toBe(0);
    expect(secondsLeft(0, at(0))).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('reads like a clock', () => {
    expect(formatCountdown(300)).toBe('5:00');
    expect(formatCountdown(299)).toBe('4:59');
    expect(formatCountdown(61)).toBe('1:01');
    expect(formatCountdown(9)).toBe('0:09');
    expect(formatCountdown(0)).toBe('0:00');
  });
});
