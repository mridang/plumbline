import { describe, expect, it } from '@jest/globals';

import {
  ChecksMenuItem,
  ChecksSwitch,
  PAUSE_WARNING,
} from '@/components/repos/checks-switch';
import { NOT_INSTALLER } from '@/components/repos/checks-messages';
import { htmlAt } from '../render';

const INSTALLER = { canManage: true, fileOff: false } as const;

describe('ChecksSwitch', () => {
  it('is a switch that is on while checks run, named for the repository', () => {
    const out = htmlAt(
      <ChecksSwitch repo="acme/site" paused={false} control={INSTALLER} />,
    );
    expect(out).toContain('role="switch"');
    expect(out).toContain('aria-checked="true"');
    expect(out).toContain('aria-label="Checks for acme/site"');
    expect(out).toContain('Checks on');
  });

  it('is off, and says the checks are paused, when they were turned off', () => {
    const out = htmlAt(
      <ChecksSwitch repo="acme/site" paused control={INSTALLER} />,
    );
    expect(out).toContain('aria-checked="false"');
    expect(out).toContain('Checks paused');
  });

  it('does not show the question until the switch is turned off', () => {
    const out = htmlAt(
      <ChecksSwitch repo="acme/site" paused={false} control={INSTALLER} />,
    );
    expect(out).not.toContain('Turn off checks for');
    expect(out).not.toContain(PAUSE_WARNING);
  });
});

describe('ChecksSwitch, who may flip it', () => {
  it('is enabled for the installer, with no explanation', () => {
    const out = htmlAt(
      <ChecksSwitch repo="acme/site" paused={false} control={INSTALLER} />,
    );
    expect(out).not.toMatch(/<button[^>]*\sdisabled[\s=>]/);
    expect(out).not.toContain('aria-describedby');
    expect(out).not.toContain(NOT_INSTALLER);
  });

  it('is disabled, not hidden, for anyone else, and explains why in text a screen reader is pointed to', () => {
    const out = htmlAt(
      <ChecksSwitch
        repo="acme/site"
        paused={false}
        control={{ canManage: false, fileOff: false }}
      />,
    );
    expect(out).toContain('role="switch"');
    expect(out).toMatch(/<button[^>]*\sdisabled[\s=>]/);
    const described = /aria-describedby="([^"]+)"/.exec(out)?.[1];
    expect(described).toBeDefined();
    expect(out).toContain(`id="${described}"`);
    expect(out).toContain(NOT_INSTALLER);
  });

  it('is disabled for the installer too while plumbline.yaml turns checks off, and says so', () => {
    const out = htmlAt(
      <ChecksSwitch
        repo="acme/site"
        paused
        control={{ canManage: true, fileOff: true }}
      />,
    );
    expect(out).toMatch(/<button[^>]*\sdisabled[\s=>]/);
    expect(out).toContain('Turned off in plumbline.yaml');
    expect(out).not.toContain(NOT_INSTALLER);
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
    const off = htmlAt(
      <ChecksMenuItem paused={false} locked={null} onRequest={() => 0} />,
    );
    const on = htmlAt(
      <ChecksMenuItem paused locked={null} onRequest={() => 0} />,
    );
    expect(off).toContain('Turn checks off');
    expect(on).toContain('Turn checks on');
    expect(off).toContain('type="button"');
    expect(off).not.toMatch(/<button[^>]*\sdisabled[\s=>]/);
  });

  it('is disabled, with the reason beside it, when the viewer may not flip the switch', () => {
    const out = htmlAt(
      <ChecksMenuItem
        paused={false}
        locked={NOT_INSTALLER}
        onRequest={() => 0}
      />,
    );
    expect(out).toMatch(/<button[^>]*\sdisabled[\s=>]/);
    expect(out).toContain('aria-describedby');
    expect(out).toContain(NOT_INSTALLER);
  });
});
