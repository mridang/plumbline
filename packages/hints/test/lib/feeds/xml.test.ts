import { describe, expect, it } from '@jest/globals';
import {
  childByName,
  descendantsByName,
  ATTRIBUTE_PATTERN,
  parseXml,
} from '../../../src/lib/feeds/xml.js';

describe('parseXml', () => {
  it('returns null when there is no element', () => {
    expect(parseXml('')).toBeNull();
    expect(parseXml('   \n  ')).toBeNull();
    expect(parseXml('<?xml version="1.0"?>')).toBeNull();
  });

  it('returns the root element with its local name lower-cased', () => {
    const root = parseXml('<RSS version="2.0"></RSS>');
    expect(root?.name).toBe('RSS');
    expect(root?.localName).toBe('rss');
    expect(root?.attrs['version']).toBe('2.0');
  });

  it('strips a namespace prefix from the local name', () => {
    const root = parseXml('<atom:feed xmlns:atom="x"></atom:feed>');
    expect(root?.localName).toBe('feed');
  });

  it('skips the prolog, comments, DOCTYPE and processing instructions', () => {
    const root = parseXml(
      '<?xml version="1.0"?><!-- c --><!DOCTYPE x><?pi ?><feed></feed>',
    );
    expect(root?.localName).toBe('feed');
  });

  it('reads text, unwrapping CDATA and decoding entities', () => {
    const root = parseXml('<title><![CDATA[A & B]]></title>');
    expect(root?.text).toBe('A & B');
    expect(parseXml('<t>a &amp; b &#65;</t>')?.text).toBe('a & b A');
  });

  it('parses self-closing elements as children with no content', () => {
    const root = parseXml('<feed><link href="x"/><id>1</id></feed>');
    expect(root?.children).toHaveLength(2);
    expect(childByName(root!, 'link')?.attrs['href']).toBe('x');
    expect(childByName(root!, 'id')?.text).toBe('1');
  });

  it('is tolerant of a mismatched close tag', () => {
    const root = parseXml('<feed><title>hi</wrong></feed>');
    expect(root?.localName).toBe('feed');
    expect(childByName(root!, 'title')?.text).toBe('hi');
  });
});

describe('childByName / descendantsByName', () => {
  const root = parseXml(
    '<rss><channel><title>t</title><item><title>i</title></item></channel></rss>',
  )!;

  it('childByName returns only a direct child', () => {
    expect(childByName(root, 'channel')?.localName).toBe('channel');
    expect(childByName(root, 'title')).toBeNull();
  });

  it('descendantsByName returns every matching descendant', () => {
    expect(descendantsByName(root, 'title')).toHaveLength(2);
  });
});

describe('parseXml tag scanning', () => {
  const shape = (xml: string): unknown => {
    const root = parseXml(xml);
    const dump = (node: NonNullable<typeof root>): unknown => ({
      name: node.name,
      attrs: node.attrs,
      text: node.text,
      children: node.children.map((child) => dump(child)),
    });
    return root ? dump(root) : null;
  };

  it('ends a tag at the first `>` outside quotes', () => {
    expect(shape(`<a b="x>y" c='1>2'>t</a>`)).toEqual({
      name: 'a',
      attrs: { b: 'x>y', c: '1>2' },
      text: 't',
      children: [],
    });
  });

  it('treats a `/` right before `>` as self-closing', () => {
    expect(shape('<a><b c="/"/><d/></a>')).toEqual({
      name: 'a',
      attrs: {},
      text: '',
      children: [
        { name: 'b', attrs: { c: '/' }, text: '', children: [] },
        { name: 'd', attrs: {}, text: '', children: [] },
      ],
    });
  });

  it('skips a `<` that does not open a complete tag', () => {
    expect(shape('<a>1 < 2</a>')).toEqual({
      name: 'a',
      attrs: {},
      text: '1 2',
      children: [],
    });
    expect(shape('<a>x <b c="d></a>')).toEqual({
      name: 'a',
      attrs: {},
      text: 'x b c="d>',
      children: [],
    });
    expect(shape('<a b="x></a>')).toBeNull();
    expect(shape('<>x</>')).toBeNull();
  });

  it('scans a 100k character tag', () => {
    const attrs = 'x="1" '.repeat(20_000);
    const root = parseXml(`<a ${attrs}/>`);
    expect(root?.attrs['x']).toBe('1');
  });
});

/** A small seeded generator, so a failure replays exactly. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

function generate(
  random: () => number,
  pieces: string[],
  count: number,
): string {
  let text = '';
  for (let i = 0; i < count; i += 1) {
    text += pieces[Math.floor(random() * pieces.length)];
  }
  return text;
}

describe('ATTRIBUTE_PATTERN', () => {
  const old = [
    String.raw`([^\s"'>/=]+)`,
    String.raw`(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?`,
  ].join('');
  const all = (text: string, pattern: string): unknown[] =>
    [...text.matchAll(new RegExp(pattern, 'g'))].map((m) => [m.index, ...m]);

  it.each([
    `a="1" b='2' c=3 d`,
    `x = "y" z= 'w' q ='r'`,
    `a="unterminated b=2`,
    '',
  ])('reads %j like the old pattern', (text) => {
    expect(all(text, ATTRIBUTE_PATTERN)).toEqual(all(text, old));
  });

  it('matches the old pattern on seeded random text', () => {
    const random = seeded(2);
    const pieces = ['a', 'b', '=', ' ', '"', "'", '>', '/', '1'];
    for (let i = 0; i < 10_000; i += 1) {
      const text = generate(random, pieces, 14);
      expect(all(text, ATTRIBUTE_PATTERN)).toEqual(all(text, old));
    }
  });

  it('agrees on a long adversarial input', () => {
    const text = `a=${'"x '.repeat(20_000)}`;
    expect(all(text, ATTRIBUTE_PATTERN)).toEqual(all(text, old));
  });
});
