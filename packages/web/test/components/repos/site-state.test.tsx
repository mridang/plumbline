import { describe, expect, it } from '@jest/globals';

import {
  StatusBadge,
  StatusDot,
  worstState,
} from '@/components/repos/site-state';
import { html } from '../render';

describe('worstState', () => {
  it('picks the state that needs the most attention', () => {
    expect(worstState(['ok', 'warning', 'failing'])).toBe('failing');
    expect(worstState(['ok', 'warning'])).toBe('warning');
    expect(worstState(['ok', 'running'])).toBe('running');
    expect(worstState(['ok', 'unreachable', 'failing'])).toBe('unreachable');
  });

  it('is unchecked for no sites', () => {
    expect(worstState([])).toBe('unchecked');
  });
});

describe('StatusDot', () => {
  it('has the colour of the state and is hidden from screen readers', () => {
    const out = html(<StatusDot state="failing" />);
    expect(out).toContain('bg-failed');
    expect(out).toContain('aria-hidden="true"');
  });

  it('pulses only while a check runs', () => {
    expect(html(<StatusDot state="running" />)).toContain('animate-pulse');
    expect(html(<StatusDot state="ok" />)).not.toContain('animate-pulse');
  });
});

describe('StatusBadge', () => {
  it('says the state in its words and its colour, with a dot', () => {
    const out = html(<StatusBadge state="failing" />);
    expect(out).toContain('Failing');
    expect(out).toContain('text-failed');
    expect(out).toContain('size-1.5');
    expect(out).toContain('bg-failed');
  });

  it('pulses only while a check runs', () => {
    expect(html(<StatusBadge state="running" />)).toContain('animate-pulse');
    expect(html(<StatusBadge state="ok" />)).not.toContain('animate-pulse');
  });

  it('has a taller size', () => {
    expect(html(<StatusBadge state="ok" size="md" />)).toContain('h-6');
  });
});
