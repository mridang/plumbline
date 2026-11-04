import { describe, expect, it } from '@jest/globals';

import {
  Announcer,
  LoadingCard,
  MessageCard,
  liveRole,
} from '@/views/status-panels';
import { html } from '../components/render';

describe('LoadingCard', () => {
  it('shows a skeleton and says what is loading', () => {
    const out = html(<LoadingCard noun="report" />);
    expect(out).toContain('class="skeleton"');
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('Loading report…');
  });

  it('names the domain once the host has said which one', () => {
    expect(html(<LoadingCard noun="report" request="example.com" />)).toContain(
      'Loading report: example.com…',
    );
  });
});

describe('MessageCard', () => {
  it('shows the server’s message, as an alert for a failure', () => {
    const out = html(
      <MessageCard
        reason="error"
        message="example.com has not been scanned yet."
      />,
    );
    expect(out).toContain('example.com has not been scanned yet.');
    expect(out).toContain('role="alert"');
    expect(out).toContain('card error');
  });

  it('shows a plain note politely, without the error styling', () => {
    const out = html(<MessageCard reason="notice" message="Nothing yet." />);
    expect(out).toContain('role="status"');
    expect(out).not.toContain('card error');
  });

  it('says so when the call was cancelled or timed out', () => {
    expect(html(<MessageCard reason="cancelled" message="x" />)).toContain(
      'Cancelled',
    );
    expect(html(<MessageCard reason="timeout" message="x" />)).toContain(
      'Still waiting',
    );
  });
});

describe('liveRole', () => {
  it('interrupts only for failures', () => {
    expect(liveRole('error')).toBe('alert');
    expect(liveRole('connection')).toBe('alert');
    expect(liveRole('notice')).toBe('status');
    expect(liveRole('cancelled')).toBe('status');
    expect(liveRole('timeout')).toBe('status');
  });
});

describe('Announcer', () => {
  it('is a polite live region that only assistive technology shows', () => {
    const out = html(<Announcer message="Report loaded: example.com" />);
    expect(out).toContain('class="sr-only"');
    expect(out).toContain('role="status"');
    expect(out).toContain('aria-live="polite"');
    expect(out).toContain('Report loaded: example.com');
  });

  it('is present, and empty, before there is anything to announce', () => {
    expect(html(<Announcer message="" />)).toContain('role="status"');
  });
});
