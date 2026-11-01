import { describe, expect, it } from '@jest/globals';
import {
  appleTouchIconFindings,
  responsiveImageFindings,
  viewportFindings,
} from '../../../src/lib/seo/mobile.js';

describe('viewportFindings', () => {
  it('errors when the tag is absent', () => {
    expect(viewportFindings(null)[0].severity).toBe('error');
  });

  it('passes width=device-width', () => {
    expect(viewportFindings('width=device-width, initial-scale=1')).toEqual([]);
  });

  it('warns when the width is not the device width', () => {
    expect(viewportFindings('width=1024')[0].message).toContain(
      'width=device-width',
    );
  });

  it('warns about blocked zooming', () => {
    expect(
      viewportFindings('width=device-width, user-scalable=no')[0].message,
    ).toContain('zoom');
    expect(
      viewportFindings('width=device-width, maximum-scale=1')[0].message,
    ).toContain('zoom');
    expect(viewportFindings('width=device-width, maximum-scale=5')).toEqual([]);
  });
});

describe('responsiveImageFindings', () => {
  const fixed = { src: 'a.jpg', srcset: '', inPicture: false };

  it('passes when there are no raster images', () => {
    expect(responsiveImageFindings([])).toEqual([]);
    expect(
      responsiveImageFindings([
        { ...fixed, src: 'logo.svg' },
        { ...fixed, src: 'data:image/gif;base64,AAAA' },
        { ...fixed, src: '' },
      ]),
    ).toEqual([]);
  });

  it('passes when srcset or picture is used on at least half', () => {
    expect(
      responsiveImageFindings([
        fixed,
        { ...fixed, srcset: 'a.jpg 1x' },
        { ...fixed, inPicture: true },
      ]),
    ).toEqual([]);
  });

  it('warns when most images are fixed size', () => {
    expect(
      responsiveImageFindings([fixed, fixed, { ...fixed, srcset: 'a 1x' }])[0]
        .message,
    ).toContain('2 of 3 images');
  });
});

describe('appleTouchIconFindings', () => {
  it('passes with an icon and warns without', () => {
    expect(appleTouchIconFindings(1)).toEqual([]);
    expect(appleTouchIconFindings(0)[0].severity).toBe('warning');
  });
});
