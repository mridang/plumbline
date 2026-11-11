import { describe, expect, it } from '@jest/globals';
import {
  formActionFinding,
  formActionFindings,
  isInsecureFormAction,
} from '../../../src/lib/secplus/form-action.js';

const HTTPS = 'https://example.test/page';
// eslint-disable-next-line unicorn/prefer-https -- test fixture
const HTTP = 'http://example.test/page';

describe('isInsecureFormAction', () => {
  it('flags an http action on an https page', () => {
    // eslint-disable-next-line unicorn/prefer-https -- test fixture
    expect(isInsecureFormAction('http://example.test/submit', HTTPS)).toBe(
      true,
    );
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
    // eslint-disable-next-line unicorn/prefer-https -- test fixture
    expect(isInsecureFormAction('http://example.test/submit', HTTP)).toBe(
      false,
    );
  });
});

describe('formActionFinding', () => {
  it('returns an error naming the action', () => {
    const found = formActionFinding(
      // eslint-disable-next-line unicorn/prefer-https -- test fixture
      { action: 'http://example.test/submit' },
      HTTPS,
    );
    expect(found?.severity).toBe('error');
    // eslint-disable-next-line unicorn/prefer-https -- test fixture
    expect(found?.message).toContain('http://example.test/submit');
  });

  it('returns null for a secure form', () => {
    expect(formActionFinding({ action: '/submit' }, HTTPS)).toBeNull();
  });
});

describe('formActionFindings', () => {
  it('returns one finding per insecure form', () => {
    const findings = formActionFindings(
      [
        // eslint-disable-next-line unicorn/prefer-https -- test fixture
        { action: 'http://a.test/' },
        { action: 'https://b.test/' },
        // eslint-disable-next-line unicorn/prefer-https -- test fixture
        { action: 'http://c.test/' },
      ],
      HTTPS,
    );
    expect(findings).toHaveLength(2);
  });
});
