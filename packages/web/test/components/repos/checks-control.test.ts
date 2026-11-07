import { describe, expect, it } from '@jest/globals';

import { controlOf, lockedReason } from '@/components/repos/checks-control';
import {
  NOT_INSTALLER,
  TURNED_OFF_IN_FILE,
} from '@/components/repos/checks-messages';

describe('lockedReason', () => {
  it('is null for the installer while the file does not turn checks off', () => {
    expect(lockedReason({ canManage: true, fileOff: false })).toBeNull();
  });

  it('says only the installer may flip it, to anyone else', () => {
    expect(lockedReason({ canManage: false, fileOff: false })).toBe(
      NOT_INSTALLER,
    );
  });

  it('says the file decides, to everyone, even the installer', () => {
    for (const canManage of [true, false]) {
      expect(lockedReason({ canManage, fileOff: true })).toContain(
        TURNED_OFF_IN_FILE,
      );
    }
  });
});

describe('controlOf', () => {
  const manageable = new Set(['acme/a']);
  const fileOff = new Set(['acme/b']);

  it('reads the two sets for the repository', () => {
    expect(controlOf('acme/a', manageable, fileOff)).toEqual({
      canManage: true,
      fileOff: false,
    });
    expect(controlOf('acme/b', manageable, fileOff)).toEqual({
      canManage: false,
      fileOff: true,
    });
  });

  it('gives a site added by hand nothing', () => {
    expect(controlOf(null, manageable, fileOff)).toEqual({
      canManage: false,
      fileOff: false,
    });
  });
});
