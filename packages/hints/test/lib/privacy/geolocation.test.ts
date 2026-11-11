import { describe, expect, it } from '@jest/globals';
import {
  findGeolocationCall,
  stripCommentsAndStrings,
  usesGeolocation,
} from '../../../src/lib/privacy/geolocation.js';

describe('usesGeolocation', () => {
  it.each([
    'navigator.geolocation.getCurrentPosition(f)',
    'navigator . geolocation . watchPosition (f)',
    "navigator['geolocation'].getCurrentPosition(f)",
    "navigator.geolocation['watchPosition'](f)",
    'const g = navigator.geolocation; g.watchPosition(cb)',
    'const { geolocation } = navigator; geolocation.getCurrentPosition(f)',
    'const { getCurrentPosition } = navigator.geolocation; getCurrentPosition(f)',
    'window.navigator.geolocation.getCurrentPosition(f) // go',
    'geolocation.getCurrentPosition (cb)',
  ])('detects %s', (code) => {
    expect(usesGeolocation(code)).toBe(true);
  });

  it.each([
    'var a = 1;',
    'const geolocationEnabled = true;',
    '',
    'if (navigator.geolocation) { show() }',
    "if ('geolocation' in navigator) { show() }",
    'const ok = !!navigator.geolocation;',
    '// navigator.geolocation.getCurrentPosition(f)',
    '/* navigator.geolocation.watchPosition(f) */ run();',
    'log("navigator.geolocation.getCurrentPosition(f)");',
    'const u = "http://x.test/"; navigator.geolocation;',
  ])('ignores %j', (code) => {
    expect(usesGeolocation(code)).toBe(false);
  });
});

describe('stripCommentsAndStrings', () => {
  it('drops comments and blanks strings but keeps API names', () => {
    expect(
      stripCommentsAndStrings('a("x // y"); // c\nb(\'geolocation\')'),
    ).toBe('a(""); \nb(geolocation)');
    expect(stripCommentsAndStrings('p /* z */ q')).toBe('p   q');
  });
  it('handles escaped quotes and unterminated input', () => {
    expect(stripCommentsAndStrings(String.raw`x("a\"b");`)).toBe('x("");');
    expect(stripCommentsAndStrings('/* open')).toBe(' ');
    expect(stripCommentsAndStrings('"open')).toBe('""');
  });
});

describe('findGeolocationCall', () => {
  it('returns the line, column and text of the call', () => {
    expect(
      findGeolocationCall('var a;\n  navigator.geolocation.watchPosition(f);'),
    ).toEqual({
      line: 1,
      column: 24,
      text: 'navigator.geolocation.watchPosition(f);',
    });
  });

  it('keeps line numbers across comments and strings', () => {
    expect(
      findGeolocationCall(
        '/* a\nb */\nvar s = `x\ny`;\ngeolocation.watchPosition(f)',
      )?.line,
    ).toBe(4);
  });

  it.each([
    'if (navigator.geolocation) { show(); }',
    'getCurrentPosition(f)',
    '// navigator.geolocation.watchPosition(f)',
  ])('returns null for %s', (source) => {
    expect(findGeolocationCall(source)).toBeNull();
  });
});
