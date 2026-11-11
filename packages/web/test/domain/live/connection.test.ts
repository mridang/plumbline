import { describe, expect, it } from '@jest/globals';

import {
  HIDDEN_GRACE_MS,
  keepStreamWhileVisible,
  type Environment,
} from '@/domain/live/connection';

/** A fake tab and clock: change what it shows and move time on by hand. */
function fake(visible = true) {
  const state = { visible, now: 0 };
  const visibility: (() => void)[] = [];
  const hide: (() => void)[] = [];
  const show: ((persisted: boolean) => void)[] = [];
  const timers = new Map<number, { at: number; handler: () => void }>();
  let next = 1;
  const environment: Environment = {
    visible: () => state.visible,
    onVisibilityChange: (handler) => {
      visibility.push(handler);
      return () => visibility.splice(visibility.indexOf(handler), 1);
    },
    onPageHide: (handler) => {
      hide.push(handler);
      return () => hide.splice(hide.indexOf(handler), 1);
    },
    onPageShow: (handler) => {
      show.push(handler);
      return () => show.splice(show.indexOf(handler), 1);
    },
    setTimeout: (handler, ms) => {
      const id = next;
      next += 1;
      timers.set(id, { at: state.now + ms, handler });
      return id;
    },
    clearTimeout: (timer) => {
      timers.delete(timer as number);
    },
  };
  const log: string[] = [];
  const stream = {
    open: () => log.push('open'),
    close: () => log.push('close'),
  };
  return {
    environment,
    stream,
    log,
    listeners: () => visibility.length + hide.length + show.length,
    setVisible(value: boolean) {
      state.visible = value;
      [...visibility].forEach((handler) => handler());
    },
    advance(ms: number) {
      state.now += ms;
      for (const [id, timer] of timers) {
        if (timer.at <= state.now) {
          timers.delete(id);
          timer.handler();
        }
      }
    },
    pagehide: () => [...hide].forEach((handler) => handler()),
    pageshow: (persisted: boolean) =>
      [...show].forEach((handler) => handler(persisted)),
  };
}

describe('keepStreamWhileVisible', () => {
  it('opens the stream at once when the tab is showing, and not when it is hidden', () => {
    const shown = fake(true);
    keepStreamWhileVisible(shown.stream, shown.environment);
    expect(shown.log).toEqual(['open']);
    const hidden = fake(false);
    keepStreamWhileVisible(hidden.stream, hidden.environment);
    expect(hidden.log).toEqual([]);
  });

  it('closes the stream once the tab has been hidden for the grace period, not before', () => {
    const tab = fake();
    keepStreamWhileVisible(tab.stream, tab.environment);
    tab.setVisible(false);
    tab.advance(HIDDEN_GRACE_MS - 1);
    expect(tab.log).toEqual(['open']);
    tab.advance(1);
    expect(tab.log).toEqual(['open', 'close']);
  });

  it('keeps the stream when the tab is shown again within the grace period', () => {
    const tab = fake();
    keepStreamWhileVisible(tab.stream, tab.environment);
    tab.setVisible(false);
    tab.advance(10_000);
    tab.setVisible(true);
    tab.advance(HIDDEN_GRACE_MS * 2);
    expect(tab.log).toEqual(['open']);
  });

  it('opens it again when the tab is shown after the stream was closed', () => {
    const tab = fake();
    keepStreamWhileVisible(tab.stream, tab.environment);
    tab.setVisible(false);
    tab.advance(HIDDEN_GRACE_MS);
    tab.setVisible(true);
    expect(tab.log).toEqual(['open', 'close', 'open']);
  });

  it('opens it once, however often the tab reports it is showing', () => {
    const tab = fake();
    keepStreamWhileVisible(tab.stream, tab.environment);
    tab.setVisible(true);
    tab.setVisible(true);
    expect(tab.log).toEqual(['open']);
  });

  it('closes it at once when the page is put away, and ends the wait that was running', () => {
    const tab = fake();
    keepStreamWhileVisible(tab.stream, tab.environment);
    tab.setVisible(false);
    tab.pagehide();
    expect(tab.log).toEqual(['open', 'close']);
    tab.advance(HIDDEN_GRACE_MS);
    expect(tab.log).toEqual(['open', 'close']);
  });

  it('opens it again when the page comes back from the back-forward cache, and ignores an ordinary show', () => {
    const tab = fake();
    keepStreamWhileVisible(tab.stream, tab.environment);
    tab.pagehide();
    tab.pageshow(false);
    expect(tab.log).toEqual(['open', 'close']);
    tab.pageshow(true);
    expect(tab.log).toEqual(['open', 'close', 'open']);
  });

  it('closes the stream, stops its timer and lets go of every listener when stopped', () => {
    const tab = fake();
    const stop = keepStreamWhileVisible(tab.stream, tab.environment);
    tab.setVisible(false);
    stop();
    expect(tab.log).toEqual(['open', 'close']);
    expect(tab.listeners()).toBe(0);
    tab.advance(HIDDEN_GRACE_MS);
    expect(tab.log).toEqual(['open', 'close']);
  });

  it('does nothing about a tab that is hidden and was never open', () => {
    const tab = fake(false);
    keepStreamWhileVisible(tab.stream, tab.environment);
    tab.advance(HIDDEN_GRACE_MS * 2);
    expect(tab.log).toEqual([]);
  });
});
