import { describe, expect, it } from '@jest/globals';

import { ConnectionIndicator } from '@/components/ui-app/connection-indicator';
import { htmlAt } from '../render';

describe('ConnectionIndicator', () => {
  it('says each state in words, as a polite status and not a control', () => {
    const connecting = htmlAt(<ConnectionIndicator state="connecting" />);
    expect(connecting).toContain('Connecting…');
    expect(connecting).toContain('role="status"');
    expect(connecting).toContain('aria-live="polite"');
    expect(connecting).not.toContain('<button');
    expect(htmlAt(<ConnectionIndicator state="live" />)).toContain(
      'Updating live',
    );
    expect(htmlAt(<ConnectionIndicator state="offline" />)).toContain(
      'Offline',
    );
  });
});
