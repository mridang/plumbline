import { describe, expect, it } from '@jest/globals';
import {
  anchorFindings,
  anchorProblem,
  contentLengthFindings,
  deprecatedTagFindings,
  frequentKeywordsFindings,
  friendlyUrlFindings,
  httpStatusFindings,
  keywordsInTitleFindings,
  linkFindings,
  topKeywords,
  visibleText,
  wordsOf,
} from '../../../src/lib/seo/content.js';

describe('visibleText', () => {
  it('drops scripts, styles, the head and comments and decodes entities', () => {
    const html =
      '<head><title>t</title></head><body><script>var a=1</script><style>p{}</style><!-- c --><p>Fish&nbsp;&amp; chips</p></body>';
    expect(visibleText(html)).toBe('Fish & chips');
  });
});

describe('wordsOf', () => {
  it('keeps apostrophes and hyphens inside words', () => {
    expect(wordsOf("it's a well-known fact")).toEqual([
      "it's",
      'a',
      'well-known',
      'fact',
    ]);
  });
});

describe('contentLengthFindings', () => {
  it('passes from 300 words', () => {
    expect(contentLengthFindings(300)).toEqual([]);
  });

  it('warns below 300 words', () => {
    expect(contentLengthFindings(299)).toEqual([
      expect.objectContaining({ severity: 'warning' }),
    ]);
  });
});

describe('topKeywords', () => {
  it('ranks by count, then alphabetically, and ignores stop words and numbers', () => {
    const text = 'the apple the apple banana banana cherry 2024 2024 and';
    expect(topKeywords(text)).toEqual([
      { word: 'apple', count: 2 },
      { word: 'banana', count: 2 },
    ]);
  });

  it('needs a word twice and honours the limit', () => {
    expect(topKeywords('one two three')).toEqual([]);
    expect(topKeywords('aaa aaa bbb bbb ccc ccc', 2)).toHaveLength(2);
  });
});

describe('frequentKeywordsFindings', () => {
  it('is silent without keywords and informs otherwise', () => {
    expect(frequentKeywordsFindings([])).toEqual([]);
    expect(frequentKeywordsFindings([{ word: 'apple', count: 3 }])[0]).toEqual(
      expect.objectContaining({ severity: 'hint' }),
    );
  });
});

describe('keywordsInTitleFindings', () => {
  const keywords = [
    { word: 'apple', count: 5 },
    { word: 'pear', count: 4 },
    { word: 'plum', count: 3 },
    { word: 'fig', count: 2 },
  ];

  it('passes when a top three keyword is in the title', () => {
    expect(keywordsInTitleFindings('Best Pear recipes', keywords)).toEqual([]);
  });

  it('warns when none is, and ignores the fourth keyword', () => {
    expect(keywordsInTitleFindings('Figs of the world', keywords)).toEqual([
      expect.objectContaining({ severity: 'warning' }),
    ]);
  });

  it('skips a missing title or no keywords', () => {
    expect(keywordsInTitleFindings(null, keywords)).toEqual([]);
    expect(keywordsInTitleFindings('Title', [])).toEqual([]);
  });
});

describe('friendlyUrlFindings', () => {
  const messages = (url: string) =>
    friendlyUrlFindings(url)
      .map((f) => f.message)
      .join(' | ');

  it('passes a clean URL and ignores an invalid one', () => {
    expect(friendlyUrlFindings('https://example.com/blog/my-post')).toEqual([]);
    expect(friendlyUrlFindings('not a url')).toEqual([]);
  });

  it('reports upper case, underscores, encoding, depth, parameters and length', () => {
    expect(messages('https://example.com/Blog')).toContain('upper-case');
    expect(messages('https://example.com/my_post')).toContain('underscores');
    expect(messages('https://example.com/caf%C3%A9')).toContain('encoded');
    expect(messages('https://example.com/a/b/c/d/e/f')).toContain('6 levels');
    expect(messages('https://example.com/?a=1&b=2&c=3')).toContain(
      '3 query parameters',
    );
    expect(messages(`https://example.com/${'a'.repeat(120)}`)).toContain(
      'characters long',
    );
  });
});

describe('linkFindings', () => {
  const page = 'https://www.example.com/';

  it('passes with an internal link, with or without www', () => {
    expect(linkFindings([{ href: 'https://example.com/a' }], page)).toEqual([]);
    expect(linkFindings([{ href: '/a' }], page)).toEqual([]);
  });

  it('warns about no links, ignoring fragments, mail and scripts', () => {
    const links = [
      { href: '#top' },
      { href: 'mailto:a@b.c' },
      { href: 'javascript:void(0)' },
      { href: 'ftp://example.com/x' },
    ];
    expect(linkFindings(links, page)[0].message).toContain('no links');
  });

  it('warns about only external links', () => {
    expect(
      linkFindings([{ href: 'https://other.org/' }], page)[0].message,
    ).toContain('none to its own site');
  });

  it('ignores an invalid page URL', () => {
    expect(linkFindings([], 'nope')).toEqual([]);
  });
});

describe('anchorProblem', () => {
  const anchor = (text: string, extra = {}) => ({
    text,
    label: '',
    imageAlt: '',
    title: '',
    ...extra,
  });

  it('accepts descriptive text', () => {
    expect(anchorProblem(anchor('Pricing plans'))).toBeNull();
  });

  it('flags generic text, with trailing punctuation', () => {
    expect(anchorProblem(anchor('Click here'))).toBe('generic');
    expect(anchorProblem(anchor('Read more »'))).toBe('generic');
    expect(anchorProblem(anchor('Learn more...'))).toBe('generic');
  });

  it('flags a link with nothing to read', () => {
    expect(anchorProblem(anchor('  '))).toBe('empty');
  });

  it('accepts a label, an image alt or a title instead of text', () => {
    expect(anchorProblem(anchor('', { label: 'Open the menu' }))).toBeNull();
    expect(anchorProblem(anchor('', { imageAlt: 'Home' }))).toBeNull();
    expect(anchorProblem(anchor('', { title: 'Home page' }))).toBeNull();
  });
});

describe('anchorFindings', () => {
  it('counts each kind separately', () => {
    const found = anchorFindings(['empty', 'generic', 'generic']);
    expect(found.map((f) => f.message)).toEqual([
      expect.stringContaining('1 links have no text'),
      expect.stringContaining('2 links use generic text'),
    ]);
    expect(anchorFindings([])).toEqual([]);
  });
});

describe('deprecatedTagFindings', () => {
  it('lists the obsolete tags that are used', () => {
    expect(
      deprecatedTagFindings({ font: 2, center: 0, marquee: 1 })[0].message,
    ).toContain('<font> (2), <marquee> (1)');
  });

  it('passes when none is used', () => {
    expect(deprecatedTagFindings({ font: 0 })).toEqual([]);
  });
});

describe('httpStatusFindings', () => {
  it('passes 200, errors on 4xx and 5xx, warns on 3xx, informs on other 2xx', () => {
    expect(httpStatusFindings(200)).toEqual([]);
    expect(httpStatusFindings(404)[0].severity).toBe('error');
    expect(httpStatusFindings(503)[0].severity).toBe('error');
    expect(httpStatusFindings(301)[0].severity).toBe('warning');
    expect(httpStatusFindings(204)[0].severity).toBe('hint');
  });
});
