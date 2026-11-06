import { describe, expect, it } from '@jest/globals';

import {
  ChecksMenuItem,
  ChecksSwitch,
  PAUSE_WARNING,
} from '@/components/repos/checks-switch';
import { htmlAt } from '../render';

describe('ChecksSwitch', () => {
  it('is a switch that is on while checks run, named for the repository', () => {
    const out = htmlAt(<ChecksSwitch repo="acme/site" paused={false} />);
    expect(out).toContain('role="switch"');
    expect(out).toContain('aria-checked="true"');
    expect(out).toContain('aria-label="Checks for acme/site"');
    expect(out).toContain('Checks on');
  });

  it('is off, and says the checks are paused, when they were turned off', () => {
    const out = htmlAt(<ChecksSwitch repo="acme/site" paused />);
    expect(out).toContain('aria-checked="false"');
    expect(out).toContain('Checks paused');
  });

  it('does not show the question until the switch is turned off', () => {
    const out = htmlAt(<ChecksSwitch repo="acme/site" paused={false} />);
    expect(out).not.toContain('Turn off checks for');
    expect(out).not.toContain(PAUSE_WARNING);
  });
});

describe('PAUSE_WARNING', () => {
  it('says what turning checks off does, and what turning them on does', () => {
    expect(PAUSE_WARNING).toContain('Webhooks and scheduled checks');
    expect(PAUSE_WARNING).toContain('open Plumbline issues are closed');
    expect(PAUSE_WARNING).toContain('resumes them');
  });
});

describe('ChecksMenuItem', () => {
  it('offers to turn checks off, or on when they are paused', () => {
    const off = htmlAt(<ChecksMenuItem paused={false} onRequest={() => 0} />);
    const on = htmlAt(<ChecksMenuItem paused onRequest={() => 0} />);
    expect(off).toContain('Turn checks off');
    expect(on).toContain('Turn checks on');
    expect(off).toContain('type="button"');
  });
});
