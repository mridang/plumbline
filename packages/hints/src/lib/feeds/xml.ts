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

/** Parses the attribute list of a start tag into a name→value map. */
function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  // name = "value" | name = 'value' | name (valueless, rare in XML)
  const pattern =
    // eslint-disable-next-line sonarjs/regex-complexity -- the name, optional value and three value forms are one grammar; splitting it would duplicate the parse
    /([^\s"'>/=]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
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
  // Matches a tag (capturing its inner source) or a run of text between tags.
  const token =
    // eslint-disable-next-line sonarjs/super-linear-regex, sonarjs/regex-complexity -- backtracking is bounded to one tag; a simpler grammar would change self-closing detection
    /<(\/?)([a-zA-Z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(cleaned)) !== null) {
    const [, closing, rawName, rawAttrs, selfClose, textRun] = match;
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
