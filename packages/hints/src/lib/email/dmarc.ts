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
  const chars = Array.from(text, (char) => char);
  return chars
    .slice(
      Math.max(
        0,
        chars.findIndex((char) => char !== ' '),
      ),
      chars.findLastIndex((char) => char !== ' ') + 1,
    )
    .join('');
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

/** Reads a directive from its tag and value; null when the value is invalid. */
function readDirective(tag: string, value: string): DmarcDirectives | null {
  switch (tag) {
    case 'p':
    case 'sp':
    case 'np': {
      if (!POLICY.test(value)) {
        return null;
      }
      const lowered = value.toLowerCase();
      const policy: DmarcPolicyValue =
        lowered === 'quarantine' || lowered === 'reject' ? lowered : 'none';
      if (tag === 'p') {
        return { request: policy };
      }
      return tag === 'sp' ? { srequest: policy } : { nrequest: policy };
    }
    case 'psd': {
      if (!YES_NO_UNKNOWN_VALUE.test(value)) {
        return null;
      }
      const flag = value.toLowerCase();
      return { psd: flag === 'y' || flag === 'n' ? flag : 'u' };
    }
    case 't': {
      return YES_NO_VALUE.test(value)
        ? { testing: value.toLowerCase() === 'y' ? 'y' : 'n' }
        : null;
    }
    case 'rua':
    case 'ruf': {
      const uris = parseUriList(value);
      if (!uris) {
        return null;
      }
      return tag === 'rua' ? { auri: uris } : { furi: uris };
    }
    case 'adkim':
    case 'aspf': {
      if (!ALIGNMENT_MODE_VALUE.test(value)) {
        return null;
      }
      const mode = value.toLowerCase() === 's' ? 's' : 'r';
      return tag === 'adkim' ? { adkim: mode } : { aspf: mode };
    }
    case 'ri': {
      return DIGITS_ONLY.test(value) ? { ainterval: value } : null;
    }
    case 'fo': {
      const options = parseColonList(value, (item) =>
        FAILURE_OPTION_VALUE.test(item),
      );
      return options ? { fo: options } : null;
    }
    case 'rf': {
      const formats = parseColonList(value, (item) => KEYWORD.test(item));
      return formats ? { rfmt: formats } : null;
    }
    case 'pct': {
      return PERCENTAGE_VALUE.test(value) ? { percent: value } : null;
    }
    default: {
      return null;
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
  const pieces =
    rest === '' ? [] : rest.split(';').map((piece) => trimSpaces(piece));
  // One trailing separator is allowed, which leaves an empty last piece.
  const tagPieces = pieces.at(-1) === '' ? pieces.slice(0, -1) : pieces;
  const matches = tagPieces.map((piece) => TAG_VALUE_PAIR.exec(piece));
  const patches = matches.map((match, index) => {
    if (!match) {
      return null;
    }
    const tag = match[1].toLowerCase();
    const seen = matches
      .slice(0, index)
      .some((earlier) => earlier?.[1].toLowerCase() === tag);
    // `p` is the only tag with a fixed place: first, straight after `v`.
    if (seen || (tag === 'p' && index !== 0)) {
      return null;
    }
    return readDirective(tag, match[2].replace(LEADING_SPACES, ''));
  });
  return patches.every((patch) => patch !== null)
    ? {
        directives: Object.fromEntries(
          patches.flatMap((patch) => Object.entries(patch)),
        ),
      }
    : null;
}
