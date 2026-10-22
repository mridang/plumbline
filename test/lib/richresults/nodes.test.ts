import { describe, expect, it } from '@jest/globals';
import {
  asObject,
  findNodesOfType,
  firstObject,
  hasValue,
  nodeHasAnyType,
  typeLabel,
} from '../../../src/lib/richresults/nodes.js';

describe('asObject', () => {
  it('returns plain objects and rejects arrays, null and primitives', () => {
    expect(asObject({ a: 1 })).toEqual({ a: 1 });
    expect(asObject([1])).toBeNull();
    expect(asObject(null)).toBeNull();
    expect(asObject('x')).toBeNull();
  });
});

describe('nodeHasAnyType', () => {
  it('matches a string @type and a member of an array @type', () => {
    expect(nodeHasAnyType({ '@type': 'Recipe' }, ['Recipe'])).toBe(true);
    expect(nodeHasAnyType({ '@type': ['WebPage', 'Recipe'] }, ['Recipe'])).toBe(
      true,
    );
    expect(nodeHasAnyType({ '@type': 'Thing' }, ['Recipe'])).toBe(false);
  });
});

describe('findNodesOfType', () => {
  it('finds nodes at top level, in arrays, in @graph and nested', () => {
    const graph = {
      '@graph': [{ '@type': 'WebSite' }, { '@type': 'Recipe', name: 'a' }],
    };
    expect(findNodesOfType(graph, ['Recipe'])).toHaveLength(1);
    expect(findNodesOfType([{ '@type': 'Event' }], ['Event'])).toHaveLength(1);
    const nested = { '@type': 'Product', offers: { '@type': 'Offer' } };
    expect(findNodesOfType(nested, ['Offer'])).toHaveLength(1);
  });

  it('descends into a matching node so nested matches are also found', () => {
    const value = {
      '@type': 'ItemList',
      itemListElement: [{ '@type': 'ItemList' }],
    };
    expect(findNodesOfType(value, ['ItemList'])).toHaveLength(2);
  });

  it('returns nothing for a non-object or an unmatched type', () => {
    expect(findNodesOfType(null, ['Recipe'])).toEqual([]);
    expect(findNodesOfType({ '@type': 'Thing' }, ['Recipe'])).toEqual([]);
  });
});

describe('hasValue', () => {
  it('treats non-blank strings, finite numbers, non-empty arrays and objects as present', () => {
    expect(hasValue({ a: 'x' }, 'a')).toBe(true);
    expect(hasValue({ a: 0 }, 'a')).toBe(true);
    expect(hasValue({ a: [1] }, 'a')).toBe(true);
    expect(hasValue({ a: { b: 1 } }, 'a')).toBe(true);
  });

  it('treats blank, empty, null, undefined and NaN as missing', () => {
    expect(hasValue({ a: '  ' }, 'a')).toBe(false);
    expect(hasValue({ a: [] }, 'a')).toBe(false);
    expect(hasValue({ a: null }, 'a')).toBe(false);
    expect(hasValue({}, 'a')).toBe(false);
    expect(hasValue({ a: Number.NaN }, 'a')).toBe(false);
  });
});

describe('firstObject', () => {
  it('returns the object, the first object of an array, or null', () => {
    expect(firstObject({ a: { x: 1 } }, 'a')).toEqual({ x: 1 });
    expect(firstObject({ a: ['s', { x: 1 }] }, 'a')).toEqual({ x: 1 });
    expect(firstObject({ a: 'x' }, 'a')).toBeNull();
    expect(firstObject({ a: [] }, 'a')).toBeNull();
  });
});

describe('typeLabel', () => {
  it('reads the string type, the first string of an array, or the fallback', () => {
    expect(typeLabel({ '@type': 'Recipe' }, 'X')).toBe('Recipe');
    expect(typeLabel({ '@type': ['Recipe', 'Thing'] }, 'X')).toBe('Recipe');
    expect(typeLabel({}, 'X')).toBe('X');
  });
});
