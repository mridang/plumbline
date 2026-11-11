import { describe, expect, it } from '@jest/globals';
import {
  formActionFinding,
  formActionFindings,
  isInsecureFormAction,
} from '../../../src/lib/secplus/form-action.js';
import { HTTP_SCHEME } from '../../helpers/data.js';

const HTTPS = 'https://example.test/page';
const HTTP = `${HTTP_SCHEME}example.test/page`;

describe('isInsecureFormAction', () => {
  it('flags an http action on an https page', () => {
    expect(
      isInsecureFormAction(`${HTTP_SCHEME}example.test/submit`, HTTPS),
    ).toBe(true);
  });

  it('accepts an https action', () => {
    expect(isInsecureFormAction('https://example.test/submit', HTTPS)).toBe(
      false,
    );
  });

  it('accepts a relative action (submits to the https page)', () => {
    expect(isInsecureFormAction('/submit', HTTPS)).toBe(false);
  });

  it('accepts an empty or absent action', () => {
    expect(isInsecureFormAction('', HTTPS)).toBe(false);
    expect(isInsecureFormAction(null, HTTPS)).toBe(false);
  });

  it('does not fire on a plain-HTTP page (out of scope)', () => {
    expect(
      isInsecureFormAction(`${HTTP_SCHEME}example.test/submit`, HTTP),
    ).toBe(false);
  });
});

describe('formActionFinding', () => {
  it('returns an error naming the action', () => {
    const found = formActionFinding(
      { action: `${HTTP_SCHEME}example.test/submit` },
      HTTPS,
    );
    expect(found?.severity).toBe('error');
    expect(found?.message).toContain(`${HTTP_SCHEME}example.test/submit`);
  });

  it('returns null for a secure form', () => {
    expect(formActionFinding({ action: '/submit' }, HTTPS)).toBeNull();
  });
});

describe('formActionFindings', () => {
  it('returns one finding per insecure form', () => {
    const findings = formActionFindings(
      [
        { action: `${HTTP_SCHEME}a.test/` },
        { action: 'https://b.test/' },
        { action: `${HTTP_SCHEME}c.test/` },
      ],
      HTTPS,
    );
    expect(findings).toHaveLength(2);
  });
});
