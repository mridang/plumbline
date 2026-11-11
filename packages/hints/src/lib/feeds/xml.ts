/**
 * A small, tolerant XML parser used by the feed and OpenSearch validators. It
 * is deliberately minimal: syndication and discovery documents are small and
 * well understood, and the validators only need to know a document's root
 * element, the elements nested inside it, their attributes and their text. A
 * full conformant XML parser (namespaces, entities, DTDs) would be far more
 * than these checks require and would pull in a dependency, which this package
 * forbids.
 *
 * "Tolerant" means the parser never throws on malformed input: it builds the
 * best tree it can and the caller decides what counts as valid. A document
 * with no element at all parses to `null`, which the validators treat as "not
 * well-formed XML". Comments, CDATA sections, processing instructions, the XML
 * declaration and a DOCTYPE are all skipped so they cannot be mistaken for
 * elements or text.
 */

/** One parsed XML element. */
export interface XmlElement {
  /** The tag name exactly as written, for example `atom:link`. */
  name: string;
  /** The tag name without any namespace prefix, lower-cased, for example `link`. */
  localName: string;
  /** Attributes by their (original-case) name. */
  attrs: Readonly<Record<string, string>>;
  /** Child elements, in document order. */
  children: XmlElement[];
  /** The concatenated direct text content of the element, trimmed. */
  text: string;
}

/** Strips a namespace prefix and lower-cases a tag or attribute name. */
function localName(name: string): string {
  const colon = name.indexOf(':');
  return (colon === -1 ? name : name.slice(colon + 1)).toLowerCase();
}

/** An attribute's name. */
const ATTRIBUTE_NAME = String.raw`([^\s"'>/=]+)`;

/** An attribute's value: double-quoted, single-quoted or bare. */
const ATTRIBUTE_VALUE = String.raw`("([^"]*)"|'([^']*)'|([^\s"'>]+))`;

/** One attribute: a name, then an optional `=` and value. */
export const ATTRIBUTE_PATTERN = [
  ATTRIBUTE_NAME,
  String.raw`(?:\s*=\s*${ATTRIBUTE_VALUE})?`,
].join('');

/** Parses the attribute list of a start tag into a name→value map. */
function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  // name = "value" | name = 'value' | name (valueless, rare in XML)
  const pattern = new RegExp(ATTRIBUTE_PATTERN, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const name = match[1];
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    attributes[name] = decodeEntities(value);
  }
  return attributes;
}

/** Decodes the five predefined XML entities plus numeric character references. */
function decodeEntities(text: string): string {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replaceAll('&amp;', '&');
}

/**
 * Removes the parts of an XML document that carry no element or text the
 * validators care about: the prolog, comments, CDATA openings, processing
 * instructions and any DOCTYPE. CDATA *content* is kept as text (its markers
 * are stripped) because a feed title may legitimately be wrapped in CDATA.
 */
function stripNonElements(source: string): string {
  return source
    .replaceAll(/<!--[\s\S]*?-->/g, '')
    .replaceAll(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replaceAll(/<\?[\s\S]*?\?>/g, '')
    .replaceAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, inner: string) => inner);
}

/** Close tag: pops the stack up to the nearest open ancestor with this name, if any. */
function closeElement(stack: XmlElement[], name: string): void {
  for (let depth = stack.length - 1; depth >= 1; depth -= 1) {
    if (stack[depth].name === name) {
      stack.length = depth;
      return;
    }
  }
}

type Token =
  | { kind: 'skip'; next: number }
  | {
      kind: 'token';
      next: number;
      closing: string;
      rawName: string;
      rawAttrs: string;
      selfClose: string;
      textRun: string;
    };

const TAG_NAME = /<(\/?)([a-zA-Z][\w:.-]*)/y;

/**
 * Reads the next token at `start`: a tag (its inner source up to the first
 * `>` outside quotes) or a run of text between tags. A `<` that does not open
 * a complete tag is skipped on its own.
 */
function nextToken(source: string, start: number): Token {
  if (source[start] !== '<') {
    const stop = source.indexOf('<', start);
    const end = stop === -1 ? source.length : stop;
    return {
      kind: 'token',
      next: end,
      closing: '',
      rawName: '',
      rawAttrs: '',
      selfClose: '',
      textRun: source.slice(start, end),
    };
  }
  TAG_NAME.lastIndex = start;
  const head = TAG_NAME.exec(source);
  if (!head) {
    return { kind: 'skip', next: start + 1 };
  }
  const nameEnd = start + head[0].length;
  let at = nameEnd;
  while (at < source.length && source[at] !== '>') {
    const quote = source[at];
    if (quote === '"' || quote === "'") {
      const close = source.indexOf(quote, at + 1);
      if (close === -1) {
        return { kind: 'skip', next: start + 1 };
      }
      at = close + 1;
    } else {
      at += 1;
    }
  }
  if (at >= source.length) {
    return { kind: 'skip', next: start + 1 };
  }
  const selfClose = at > nameEnd && source[at - 1] === '/' ? '/' : '';
  return {
    kind: 'token',
    next: at + 1,
    closing: head[1],
    rawName: head[2],
    rawAttrs: source.slice(nameEnd, selfClose ? at - 1 : at),
    selfClose,
    textRun: '',
  };
}

/**
 * Parses `source` into a tree and returns its root element, or `null` when the
 * document contains no element. A mismatched or unclosed tag is handled
 * gracefully: a close tag that matches an ancestor pops up to it, and anything
 * still open at the end is closed implicitly, so broken markup yields a partial
 * tree rather than an exception.
 */
export function parseXml(source: string): XmlElement | null {
  const cleaned = stripNonElements(source);
  const root: XmlElement = {
    name: '#root',
    localName: '#root',
    attrs: {},
    children: [],
    text: '',
  };
  const stack: XmlElement[] = [root];
  let position = 0;
  while (position < cleaned.length) {
    const token = nextToken(cleaned, position);
    position = token.next;
    if (token.kind === 'skip') {
      continue;
    }
    const { closing, rawName, rawAttrs, selfClose, textRun } = token;
    const current = stack.at(-1) ?? root;
    if (textRun) {
      // Text belongs to whichever element is currently open.
      const value = decodeEntities(textRun).trim();
      if (value !== '') {
        current.text = current.text === '' ? value : `${current.text} ${value}`;
      }
    } else if (closing === '/') {
      closeElement(stack, rawName);
    } else {
      const element: XmlElement = {
        name: rawName,
        localName: localName(rawName),
        attrs: parseAttributes(rawAttrs),
        children: [],
        text: '',
      };
      current.children.push(element);
      if (selfClose !== '/') {
        stack.push(element);
      }
    }
  }
  return root.children.at(0) ?? null;
}

/** Returns the first direct child of `element` whose local name matches. */
export function childByName(
  element: XmlElement,
  name: string,
): XmlElement | null {
  const want = name.toLowerCase();
  return element.children.find((child) => child.localName === want) ?? null;
}

/** Returns every descendant of `element` (excluding itself) whose local name matches. */
export function descendantsByName(
  element: XmlElement,
  name: string,
): XmlElement[] {
  const want = name.toLowerCase();
  const found: XmlElement[] = [];
  const walk = (node: XmlElement): void => {
    for (const child of node.children) {
      if (child.localName === want) {
        found.push(child);
      }
      walk(child);
    }
  };
  walk(element);
  return found;
}
