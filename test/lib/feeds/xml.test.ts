import { describe, expect, it } from '@jest/globals';
import {
  childByName,
  descendantsByName,
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
