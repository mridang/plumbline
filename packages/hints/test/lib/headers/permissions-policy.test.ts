import { describe, expect, it } from '@jest/globals';
import {
  DISABLED_FEATURES,
  parsePermissionsPolicy,
  permissionsPolicyFindings,
} from '../../../src/lib/headers/permissions-policy.js';

const full = [...DISABLED_FEATURES.map((f) => `${f}=()`), 'sync-xhr=()'].join(
  ', ',
);

describe('parsePermissionsPolicy', () => {
  it('maps features to normalised allowlists', () => {
    const policy = parsePermissionsPolicy(
      'camera=( ), geolocation=(self "https://a.example"), fullscreen=*',
    );
    expect(policy.get('camera')).toBe('()');
    expect(policy.get('geolocation')).toBe('(self "https://a.example")');
    expect(policy.get('fullscreen')).toBe('*');
  });

  it('does not split on commas inside parentheses or quotes and keeps the first duplicate', () => {
    const policy = parsePermissionsPolicy(
      'a=("x,y" self), b=(), b=(self), junk',
    );
    expect(policy.get('a')).toBe('("x,y" self)');
    expect(policy.get('b')).toBe('()');
    expect(policy.has('junk')).toBe(false);
  });

  it('drops parameters after the closing parenthesis', () => {
    expect(parsePermissionsPolicy('camera=();report-to=x').get('camera')).toBe(
      '()',
    );
  });
});

describe('permissionsPolicyFindings', () => {
  it('lists 28 disabled features', () => {
    expect(DISABLED_FEATURES).toHaveLength(28);
  });

  it('passes a full policy', () => {
    expect(permissionsPolicyFindings(full)).toEqual([]);
  });

  it('accepts sync-xhr=(self)', () => {
    expect(
      permissionsPolicyFindings(full.replace('sync-xhr=()', 'sync-xhr=(self)')),
    ).toEqual([]);
  });

  it('accepts clipboard-write=(self)', () => {
    expect(
      permissionsPolicyFindings(
        full.replace('clipboard-write=()', 'clipboard-write=(self)'),
      ),
    ).toEqual([]);
  });

  it.each(['microphone', 'fullscreen', 'camera'])(
    'accepts %s=(self)',
    (feature) => {
      expect(
        permissionsPolicyFindings(
          full.replace(`${feature}=()`, `${feature}=(self)`),
        ),
      ).toEqual([]);
    },
  );

  it('flags a feature opened to other origins', () => {
    const [f] = permissionsPolicyFindings(
      full.replace('microphone=()', 'microphone=(self "https://x.test")'),
    );
    expect(f?.message).toContain('microphone');
  });

  it('flags clipboard-write that is neither () nor (self)', () => {
    const [f] = permissionsPolicyFindings(
      full.replace('clipboard-write=()', 'clipboard-write=*'),
    );
    expect(f?.message).toContain('clipboard-write');
  });

  it('errors when the header is missing', () => {
    expect(permissionsPolicyFindings(null)[0]?.message).toContain(
      'not specified',
    );
  });

  it('lists features that are missing or enabled', () => {
    const value = full.replace('camera=()', 'camera=*').replace(', usb=()', '');
    const [f] = permissionsPolicyFindings(value);
    expect(f?.message).toContain('camera, usb.');
  });

  it('flags sync-xhr that is neither () nor (self)', () => {
    const [f] = permissionsPolicyFindings(
      full.replace('sync-xhr=()', 'sync-xhr=*'),
    );
    expect(f?.message).toContain('sync-xhr');
  });
});
