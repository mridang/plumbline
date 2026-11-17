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
function parseAttributes(source: string) {
  // name = "value" | name = 'value' | name (valueless, rare in XML)
  return Object.fromEntries(
    Array.from(
      source.matchAll(new RegExp(ATTRIBUTE_PATTERN, 'gu')),
      (match) => [
        match[1],
        decodeEntities(match[3] ?? match[4] ?? match[5] ?? ''),
      ],
    ),
  );
}

/** Decodes the five predefined XML entities plus numeric character references. */
function decodeEntities(text: string): string {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll(/&#x([0-9a-fA-F]+);/gu, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/gu, (_, dec: string) =>
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
    .replaceAll(/<!--[\s\S]*?-->/gu, '')
    .replaceAll(/<!DOCTYPE[\s\S]*?>/giu, '')
    .replaceAll(/<\?[\s\S]*?\?>/gu, '')
    .replaceAll(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, (_, inner: string) => inner);
}

/** Close tag: pops the stack up to the nearest open ancestor with this name, if any. */
function closeElement(stack: XmlElement[], name: string): void {
  const depth = stack.findLastIndex(
    (element, index) => index >= 1 && element.name === name,
  );
  if (depth !== -1) {
    // eslint-disable-next-line functional/immutable-data -- the open-element stack is edited in place by the tree builder
    stack.length = depth;
  }
}

/**
 * One token of a document: a run of text between tags, or a tag (its name,
 * and its attributes up to the first `>` outside quotes), or a lone `<` that
 * does not open a complete tag and is skipped on its own.
 */
const TOKEN = new RegExp(
  [
    '(?<text>[^<]+)',
    String.raw`<(?<closing>/?)(?<name>[a-zA-Z][\w:.-]*)(?<attrs>(?:[^>"']|"[^"]*"|'[^']*')*)>`,
    '<',
  ].join('|'),
  'gu',
);

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
  // eslint-disable-next-line functional/no-loop-statements -- a sequential scan that builds the tree in document order; recursion would overflow the call stack on deeply nested documents
  for (const token of cleaned.matchAll(TOKEN)) {
    const { text: textRun, closing, name: rawName, attrs } = token.groups ?? {};
    const current = stack.at(-1) ?? root;
    if (textRun) {
      // Text belongs to whichever element is currently open.
      const value = decodeEntities(textRun).trim();
      if (value !== '') {
        // eslint-disable-next-line functional/immutable-data -- the tree builder fills the elements it created
        current.text = current.text === '' ? value : `${current.text} ${value}`;
      }
    } else if (!rawName) {
      // A lone `<` opens nothing.
    } else if (closing === '/') {
      closeElement(stack, rawName);
    } else {
      const selfClose = attrs.endsWith('/');
      const element: XmlElement = {
        name: rawName,
        localName: localName(rawName),
        attrs: parseAttributes(selfClose ? attrs.slice(0, -1) : attrs),
        children: [],
        text: '',
      };
      // eslint-disable-next-line functional/immutable-data -- the tree builder fills the elements it created
      current.children.push(element);
      if (!selfClose) {
        // eslint-disable-next-line functional/immutable-data -- the open-element stack is edited in place by the tree builder
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
  const walk = (node: XmlElement): XmlElement[] =>
    node.children.flatMap((child) => [
      ...(child.localName === want ? [child] : []),
      ...walk(child),
    ]);
  return walk(element);
}
