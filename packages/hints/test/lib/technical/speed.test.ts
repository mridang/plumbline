import { describe, expect, it } from '@jest/globals';
import {
  assetFindings,
  htmlSizeFindings,
  imageFormat,
  imageFormatFindings,
  lazyLoadingFindings,
  responseTimeFindings,
} from '../../../src/lib/technical/speed.js';

describe('responseTimeFindings', () => {
  it('passes up to 600 ms, warns to 1.5 s and errors above', () => {
    expect(responseTimeFindings(600)).toEqual([]);
    expect(responseTimeFindings(601)[0].severity).toBe('warning');
    expect(responseTimeFindings(1500)[0].severity).toBe('warning');
    expect(responseTimeFindings(1501)[0].severity).toBe('error');
  });
});

describe('htmlSizeFindings', () => {
  it('passes to 200 KB, warns to 2 MB and errors above', () => {
    expect(htmlSizeFindings(200 * 1024)).toEqual([]);
    expect(htmlSizeFindings(200 * 1024 + 1)[0].severity).toBe('warning');
    expect(htmlSizeFindings(2 * 1024 * 1024)[0].severity).toBe('warning');
    expect(htmlSizeFindings(2 * 1024 * 1024 + 1)[0].severity).toBe('error');
  });
});

describe('assetFindings', () => {
  const lean = { scripts: 15, stylesheets: 10, blockingScripts: 0 };

  it('passes at the limits', () => {
    expect(assetFindings(lean)).toEqual([]);
  });

  it('warns about each excess separately', () => {
    const messages = assetFindings({
      scripts: 16,
      stylesheets: 11,
      blockingScripts: 2,
    }).map((f) => f.message);
    expect(messages).toEqual([
      expect.stringContaining('16 external scripts'),
      expect.stringContaining('11 external stylesheets'),
      expect.stringContaining('2 scripts in the <head>'),
    ]);
  });
});

describe('imageFormat', () => {
  it('sorts URLs by extension, ignoring the query', () => {
    expect(imageFormat('/a.webp')).toBe('modern');
    expect(imageFormat('/a.AVIF?w=2')).toBe('modern');
    expect(imageFormat('/a.jpeg#x')).toBe('legacy');
    expect(imageFormat('/a.png')).toBe('legacy');
    expect(imageFormat('/a.svg')).toBe('other');
    expect(imageFormat('/a')).toBe('other');
  });
});

describe('imageFormatFindings', () => {
  const legacy = { urls: ['a.jpg'], hasModernSource: false };

  it('passes without legacy images', () => {
    expect(imageFormatFindings([])).toEqual([]);
    expect(
      imageFormatFindings([{ urls: ['a.svg'], hasModernSource: false }]),
    ).toEqual([]);
  });

  it('warns when only legacy formats are used', () => {
    expect(imageFormatFindings([legacy])[0].severity).toBe('warning');
  });

  it('only hints when a modern format is also used', () => {
    expect(
      imageFormatFindings([
        legacy,
        { urls: ['b.webp'], hasModernSource: false },
      ])[0].severity,
    ).toBe('hint');
    expect(
      imageFormatFindings([{ urls: ['a.jpg'], hasModernSource: true }]),
    ).toEqual([]);
  });
});

describe('lazyLoadingFindings', () => {
  it('ignores the first two images', () => {
    expect(lazyLoadingFindings([{ lazy: false }, { lazy: false }])).toEqual([]);
  });

  it('warns about later images that are not lazy', () => {
    expect(
      lazyLoadingFindings([
        { lazy: false },
        { lazy: false },
        { lazy: false },
        { lazy: true },
        { lazy: false },
      ])[0].message,
    ).toContain('2 images after the first 2');
  });
});
