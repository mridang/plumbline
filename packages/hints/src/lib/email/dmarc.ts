/**
 * A parser for DMARC records, ported from Internet.nl's `dmarc_parser.py`,
 * which follows section 6.4 of RFC 7489 plus the `np` tag of RFC 9091 and the
 * `psd` and `t` tags of RFC 9989. Like the original it is strict: a record
 * with an unknown or repeated tag, or with `p` anywhere but first, is not
 * valid. Only spaces (not tabs) may surround `;`, `=` and `,`.
 */

/** Matches a space, comma or semicolon. */
const URI_SEPARATOR_CHARACTER = /[ ,;]/u;

/** Matches a single `y`, `n` or `u` in either case. */
const YES_NO_UNKNOWN_VALUE = /^[ynuYNU]$/u;

/** Matches a single `y` or `n` in either case. */
const YES_NO_VALUE = /^[ynYN]$/u;

/** Matches a single `r` or `s` in either case. */
const ALIGNMENT_MODE_VALUE = /^[rsRS]$/u;

/** Matches a string made only of digits. */
const DIGITS_ONLY = /^\d+$/u;

/** Matches a single failure-report option character. */
const FAILURE_OPTION_VALUE = /^[01dsDS]$/u;

/** Matches a one to three digit number. */
const PERCENTAGE_VALUE = /^\d{1,3}$/u;

/** Matches the `v=DMARC1` tag at the start of a record. */
const VERSION_TAG = /^[vV] *= *DMARC1 *; */u;

/** Matches a `tag=value` pair and captures both parts. */
const TAG_VALUE_PAIR = /^([A-Za-z]+) *=(.*)$/u;

/** Matches the spaces at the start of a string. */
const LEADING_SPACES = /^ +/u;

type DmarcPolicyValue = 'none' | 'quarantine' | 'reject';

interface DmarcDirectives {
  /** `p=`, the policy for the domain. */
  request?: DmarcPolicyValue;
  /** `sp=`, the policy for subdomains. */
  srequest?: DmarcPolicyValue;
  /** `np=`, the policy for non-existent subdomains. */
  nrequest?: DmarcPolicyValue;
  /** `psd=`, public suffix domain flag. */
  psd?: 'y' | 'n' | 'u';
  /** `t=`, test mode flag. */
  testing?: 'y' | 'n';
  /** `rua=`, aggregate report URIs. */
  auri?: string[];
  /** `ruf=`, failure report URIs. */
  furi?: string[];
  adkim?: 'r' | 's';
  aspf?: 'r' | 's';
  /** `ri=`, report interval in seconds as written. */
  ainterval?: string;
  /** `fo=`, failure reporting options. */
  fo?: string[];
  /** `rf=`, failure report formats. */
  rfmt?: string[];
  /** `pct=`, percentage as written. */
  percent?: string;
}

export interface DmarcRecord {
  directives: DmarcDirectives;
}

const POLICY = /^(?:none|quarantine|reject)$/iu;
const URI_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/u;
const URI_SIZE = /^\d+[kmgtKMGT]?$/u;
const KEYWORD = /^[A-Za-z0-9-]*[A-Za-z0-9]$/u;

/** Trims spaces only; DMARC's grammar allows no other whitespace. */
const trimSpaces = (text: string): string => {
  let start = 0;
  let end = text.length;
  while (start < end && text.codePointAt(start) === 32) {
    start += 1;
  }
  while (end > start && text.codePointAt(end - 1) === 32) {
    end -= 1;
  }
  return text.slice(start, end);
};

/** Validates one `dmarc-uri`: a URI with an optional `!size` limit. */
function isValidUri(uri: string): boolean {
  if (uri === '' || URI_SEPARATOR_CHARACTER.test(uri)) {
    return false;
  }
  const bangs = uri.split('!').length - 1;
  if (bangs > 1) {
    return false;
  }
  const [address, size] = uri.split('!');
  if (bangs === 1 && !URI_SIZE.test(size)) {
    return false;
  }
  return URI_SCHEME.test(address);
}

function parseUriList(value: string): string[] | null {
  const uris = value.split(',').map((uri) => trimSpaces(uri));
  return uris.every((uri) => isValidUri(uri)) ? uris : null;
}

function parseColonList(
  value: string,
  isValid: (item: string) => boolean,
): string[] | null {
  const items = value.split(':').map((item) => trimSpaces(item));
  return items.every((item) => isValid(item))
    ? items.map((item) => item.toLowerCase())
    : null;
}

/** Sets a directive from its tag and value; false when the value is invalid. */
function setDirective(
  directives: DmarcDirectives,
  tag: string,
  value: string,
): boolean {
  switch (tag) {
    case 'p':
    case 'sp':
    case 'np': {
      if (!POLICY.test(value)) {
        return false;
      }
      const policy = value.toLowerCase() as DmarcPolicyValue;
      if (tag === 'p') {
        directives.request = policy;
      } else if (tag === 'sp') {
        directives.srequest = policy;
      } else {
        directives.nrequest = policy;
      }
      return true;
    }
    case 'psd': {
      if (!YES_NO_UNKNOWN_VALUE.test(value)) {
        return false;
      }
      directives.psd = value.toLowerCase() as 'y' | 'n' | 'u';
      return true;
    }
    case 't': {
      if (!YES_NO_VALUE.test(value)) {
        return false;
      }
      directives.testing = value.toLowerCase() as 'y' | 'n';
      return true;
    }
    case 'rua':
    case 'ruf': {
      const uris = parseUriList(value);
      if (!uris) {
        return false;
      }
      if (tag === 'rua') {
        directives.auri = uris;
      } else {
        directives.furi = uris;
      }
      return true;
    }
    case 'adkim':
    case 'aspf': {
      if (!ALIGNMENT_MODE_VALUE.test(value)) {
        return false;
      }
      directives[tag] = value.toLowerCase() as 'r' | 's';
      return true;
    }
    case 'ri': {
      if (!DIGITS_ONLY.test(value)) {
        return false;
      }
      directives.ainterval = value;
      return true;
    }
    case 'fo': {
      const options = parseColonList(value, (item) =>
        FAILURE_OPTION_VALUE.test(item),
      );
      if (!options) {
        return false;
      }
      directives.fo = options;
      return true;
    }
    case 'rf': {
      const formats = parseColonList(value, (item) => KEYWORD.test(item));
      if (!formats) {
        return false;
      }
      directives.rfmt = formats;
      return true;
    }
    case 'pct': {
      if (!PERCENTAGE_VALUE.test(value)) {
        return false;
      }
      directives.percent = value;
      return true;
    }
    default: {
      return false;
    }
  }
}

/**
 * Parses a DMARC record. Returns null when the record is not syntactically
 * valid. A record with a version but no tags (`v=DMARC1;`) parses with empty
 * directives; the policy test then reports the missing `p`.
 */
export function parseDmarc(record: string): DmarcRecord | null {
  const version = VERSION_TAG.exec(record);
  if (!version) {
    return null;
  }
  const rest = record.slice(version[0].length);
  const directives: DmarcDirectives = {};
  const pieces =
    rest === '' ? [] : rest.split(';').map((piece) => trimSpaces(piece));
  // One trailing separator is allowed, which leaves an empty last piece.
  if (pieces.length > 0 && pieces.at(-1) === '') {
    pieces.pop();
  }
  const seen = new Set<string>();
  for (const [index, piece] of pieces.entries()) {
    const match = TAG_VALUE_PAIR.exec(piece);
    if (!match) {
      return null;
    }
    const tag = match[1].toLowerCase();
    // `p` is the only tag with a fixed place: first, straight after `v`.
    if (seen.has(tag) || (tag === 'p' && index !== 0)) {
      return null;
    }
    seen.add(tag);
    if (!setDirective(directives, tag, match[2].replace(LEADING_SPACES, ''))) {
      return null;
    }
  }
  return { directives };
}
