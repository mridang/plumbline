import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import type { PageFacts } from '@/domain/suite/facts';
import { anchorTexts, imageUrls } from '@/domain/suite/facts';

import { inWorkerd } from '../../helpers/workerd';

describe('extractFacts', () => {
  let worker: Awaited<ReturnType<typeof inWorkerd<PageFacts>>>;

  beforeAll(async () => {
    worker = await inWorkerd<PageFacts>('@/domain/suite/facts', 'extractFacts');
  });

  afterAll(async () => {
    await worker.dispose();
  });

  it('reads the title, viewport and icons', async () => {
    const facts = await worker.run(
      `<html><head><title> My page </title>
        <meta name="Viewport" content="width=device-width">
        <link rel="apple-touch-icon" href="/a.png">
        <link rel="stylesheet" href="/a.css"><link rel="stylesheet"></head></html>`,
    );
    expect(facts.title).toBe('My page');
    expect(facts.viewport).toBe('width=device-width');
    expect(facts.appleTouchIcons).toBe(1);
    expect(facts.stylesheets).toBe(1);
  });

  it('leaves the title and viewport null when the page has none', async () => {
    const facts = await worker.run('<p>hi</p>');
    expect(facts.title).toBeNull();
    expect(facts.viewport).toBeNull();
  });

  it('collects the link targets', async () => {
    const facts = await worker.run(
      '<a href="/a">a</a><a>no</a><a href="b">b</a>',
    );
    expect(facts.hrefs).toEqual(['/a', 'b']);
  });

  it('counts scripts and the ones in the head that block rendering', async () => {
    const facts = await worker.run(
      `<head><script src="/a.js"></script><script src="/b.js" async></script>
        <script src="/c.js" defer></script><script src="/d.js" type="module"></script></head>
        <body><script src="/e.js"></script></body>`,
    );
    expect(facts.scripts).toBe(5);
    expect(facts.blockingScripts).toBe(1);
  });

  it('reads images and the WebP source of their picture', async () => {
    const facts = await worker.run(
      `<picture><source type="image/webp" srcset="a.webp"><img src="a.jpg" alt=""></picture>
        <img src="b.png" srcset="b.png 1x, b@2x.png 2x" loading="LAZY"><iframe loading="lazy"></iframe>`,
    );
    expect(facts.images).toEqual([
      {
        src: 'a.jpg',
        srcset: '',
        inPicture: true,
        modernSource: true,
        lazy: false,
      },
      {
        src: 'b.png',
        srcset: 'b.png 1x, b@2x.png 2x',
        inPicture: false,
        modernSource: false,
        lazy: true,
      },
    ]);
    expect(facts.iframes).toEqual([{ lazy: true }]);
  });

  it('counts obsolete elements', async () => {
    const facts = await worker.run(
      '<center>a</center><font>b</font><font>c</font>',
    );
    expect(facts.deprecated).toEqual({ center: 1, font: 2 });
  });
});

describe('imageUrls', () => {
  it('lists the src and every srcset candidate', () => {
    expect(imageUrls('a.jpg', 'b.webp 1x, c.webp 2x')).toEqual([
      'a.jpg',
      'b.webp',
      'c.webp',
    ]);
  });

  it('skips an empty src and srcset', () => {
    expect(imageUrls('', '')).toEqual([]);
  });
});

describe('anchorTexts', () => {
  it('reads the inner HTML, label, title and image alt of each link', () => {
    expect(
      anchorTexts(
        `<a href="/x" aria-label="Go" title='Tip'><img src="i.png" alt="Logo"> Home</a>`,
      ),
    ).toEqual([
      {
        inner: '<img src="i.png" alt="Logo"> Home',
        label: 'Go',
        title: 'Tip',
        imageAlt: 'Logo',
      },
    ]);
  });

  it('ignores anchors without an href', () => {
    expect(anchorTexts('<a name="top">x</a>')).toEqual([]);
  });
});
