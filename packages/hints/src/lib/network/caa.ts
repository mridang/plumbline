/**
 * CAA checks ported from Internet.nl (checks/caa/*.py). Records are looked up
 * on the host and, when absent, on each parent name (RFC 8659 section 3),
 * then each record is validated for syntax (RFC 8659 section 4, RFC 8657,
 * RFC 9495 and the CA/Browser Forum properties) and the set must contain at
 * least one `issue` property.
 */
import { answersOfType, normalizeName, safeQuery, RR } from './dns-util.js';

/** At most this many records are evaluated, as in Internet.nl. */
const CAA_MAX_RECORDS = 100;

export interface CaaRecord {
  flags: number;
  tag: string;
  value: string;
}

export interface CaaEvaluation {
  found: boolean;
  /** The name the records were found on. */
  foundOn: string | null;
  records: CaaRecord[];
  /** Human readable problems, wording from Internet.nl's tech tables. */
  errors: { id: string; message: string }[];
}

/** Internet.nl's id for "no `issue` property". */
export const MISSING_ISSUE = 'missing-required-property-issue';

/** Renders a record as a zone file line, for use as report evidence. */
export function formatCaa(record: CaaRecord, name: string): string {
  return `${name}. IN CAA ${record.flags} ${record.tag} "${record.value}"`;
}

/** Decodes the hex of a generic `\# n hex` record into bytes. */
function fromGeneric(data: string): Buffer | null {
  const text = data.trim();
  if (!text.startsWith(String.raw`\#`)) {
    return null;
  }
  const afterMarker = text.slice(2).trimStart();
  if (afterMarker.length === text.length - 2) {
    return null;
  }
  const digits = afterMarker.search(/\D/);
  const length = digits === -1 ? afterMarker.length : digits;
  if (length === 0) {
    return null;
  }
  let hex = afterMarker.slice(length);
  if (/^\s/.test(hex)) {
    hex = hex.slice(1);
  }
  return /^[\da-fA-F\s]*$/.test(hex)
    ? Buffer.from(hex.replaceAll(/\s+/g, ''), 'hex')
    : null;
}

/** Parses a CAA record in presentation (`0 issue "ca.example"`) or generic form. */
export function parseCaa(data: string): CaaRecord | null {
  const generic = fromGeneric(data);
  if (generic) {
    // flags (1 byte), tag length (1 byte), tag, value.
    if (generic.length < 2 || generic.length < 2 + generic[1]) {
      return null;
    }
    const tagLength = generic[1];
    return {
      flags: generic[0],
      tag: generic.subarray(2, 2 + tagLength).toString('ascii'),
      value: generic.subarray(2 + tagLength).toString('utf8'),
    };
  }
  const m = /^(\d+)\s+([A-Za-z0-9]+)\s(.*)$/s.exec(data.trim());
  if (!m) {
    return null;
  }
  let value = m[3].trim();
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    value = value.slice(1, -1).replaceAll(/\\(.)/g, '$1');
  }
  return { flags: Number(m[1]), tag: m[2], value };
}

const LABEL = '[A-Za-z0-9](?:-*[A-Za-z0-9])*';
const DOMAIN = new RegExp(String.raw`^${LABEL}(?:\.${LABEL})*$`);
const PARAMETER = new RegExp(
  String.raw`^${LABEL}[ \t]*=[ \t]*[\x21-\x3A\x3C-\x7E]*$`,
);
const EMAIL = /^[^\s@;<>,"]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
const PHONE = /^\+(?=[\d.()-]*\d)[\d.()-]*(?:;.*)?$/;

/** Https://www.iana.org/assignments/acme/acme.xhtml#acme-validation-methods */
const ACME_METHODS = new Set([
  'http-01',
  'dns-01',
  'tls-alpn-01',
  'email-reply-00',
  'tkauth-01',
  'onion-csr-01',
  'bp-nodeid-00',
]);

/**
 * Validates the value of `issue`, `issuewild`, `issuevmc` and `issuemail`:
 * an optional issuer domain, then optional `;`-separated `tag=value`
 * parameters. Returns an error id or null.
 */
function checkIssueValue(value: string): string | null {
  const [issuerPart, ...rest] = value.split(';');
  const issuer = issuerPart.trim();
  if (issuer !== '' && !DOMAIN.test(issuer)) {
    return 'invalid-property-syntax';
  }
  const parameters = rest.join(';').trim();
  if (rest.length > 0 && parameters !== '') {
    for (const parameter of parameters.split(';').map((p) => p.trim())) {
      const error = checkIssueParameter(parameter);
      if (error !== null) {
        return error;
      }
    }
  }
  return null;
}

/** Validates one `tag=value` parameter of an issue property. Returns an error id or null. */
function checkIssueParameter(parameter: string): string | null {
  if (!PARAMETER.test(parameter)) {
    return 'invalid-property-syntax';
  }
  const [name, ...v] = parameter.split('=');
  if (name.trim() !== 'validationmethods') {
    return null;
  }
  // RFC 8657 section 4: comma separated, known or `ca-` prefixed.
  const methods = v.join('=').trim();
  const labels = methods === '' ? [] : methods.split(',');
  for (const label of labels) {
    if (
      !/^[A-Za-z0-9-]+$/.test(label) ||
      (!ACME_METHODS.has(label) && !label.startsWith('ca-'))
    ) {
      return 'invalid-parameter-validation-methods';
    }
  }
  return null;
}

/** Validates the value of `iodef`: an https URL or a mailto address. */
function checkIodef(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.host !== '') {
      return null;
    }
    if (
      url.protocol === 'mailto:' &&
      EMAIL.test(decodeURIComponent(url.pathname))
    ) {
      return null;
    }
  } catch {
    // Falls through to the error.
  }
  return 'invalid-property-iodef-value';
}

/** Messages follow the Internet.nl tech table wording. */
function describeError(id: string, record: CaaRecord): string {
  switch (id) {
    case MISSING_ISSUE: {
      return "Error: Required 'issue' property missing";
    }
    case 'invalid-flags-reserved-bits': {
      return `Error: Invalid flags ${record.flags} (only 0 and 128 are allowed)`;
    }
    case 'invalid-reserved-property': {
      return `Error: The '${record.tag}' property is reserved`;
    }
    case 'invalid-unknown-property': {
      return `Error: Unknown property '${record.tag}'`;
    }
    case 'invalid-parameter-validation-methods': {
      return `Error: Invalid validationmethods parameter in '${record.tag}': ${record.value}`;
    }
    case 'invalid-property-iodef-value': {
      return `Error: Invalid iodef value '${record.value}' (use https or mailto)`;
    }
    case 'invalid-property-contactemail-value': {
      return `Error: Invalid contactemail value '${record.value}'`;
    }
    case 'invalid-property-contactphone-value': {
      return `Error: Invalid contactphone value '${record.value}'`;
    }
    case 'invalid-property-issuemail-value': {
      return `Error: Invalid issuemail value '${record.value}'`;
    }
    default: {
      return `Error: Invalid syntax in '${record.tag}': ${record.value}`;
    }
  }
}

/** Validates one record and returns the error id, or null when it is fine. */
export function validateCaaRecord(record: CaaRecord): string | null {
  if (record.flags !== 0 && record.flags !== 128) {
    return 'invalid-flags-reserved-bits';
  }
  const tag = record.tag.toLowerCase();
  switch (tag) {
    case 'issue':
    case 'issuewild':
    case 'issuevmc': {
      return checkIssueValue(record.value);
    }
    case 'issuemail': {
      const error = checkIssueValue(record.value);
      return error === null ? null : 'invalid-property-issuemail-value';
    }
    case 'iodef': {
      return checkIodef(record.value);
    }
    case 'contactemail': {
      return EMAIL.test(record.value)
        ? null
        : 'invalid-property-contactemail-value';
    }
    case 'contactphone': {
      return PHONE.test(record.value)
        ? null
        : 'invalid-property-contactphone-value';
    }
    case 'auth':
    case 'path':
    case 'policy': {
      return 'invalid-reserved-property';
    }
    default: {
      return 'invalid-unknown-property';
    }
  }
}

/** Evaluates a record set: syntax of each record and the `issue` requirement. */
export function evaluateCaa(
  records: CaaRecord[],
  foundOn: string | null,
): CaaEvaluation {
  const evaluated = records.slice(0, CAA_MAX_RECORDS);
  const errors: CaaEvaluation['errors'] = [];
  for (const record of evaluated) {
    const id = validateCaaRecord(record);
    if (id) {
      errors.push({ id, message: describeError(id, record) });
    }
  }
  if (!evaluated.some((r) => r.tag.toLowerCase() === 'issue')) {
    errors.push({
      id: MISSING_ISSUE,
      message: describeError(MISSING_ISSUE, {
        flags: 0,
        tag: 'issue',
        value: '',
      }),
    });
  }
  return { found: evaluated.length > 0, foundOn, records: evaluated, errors };
}

/**
 * Finds the CAA records that apply to a host by climbing the tree
 * (RFC 8659 section 3) and evaluates them.
 */
export async function retrieveCaa(host: string): Promise<CaaEvaluation> {
  let name = normalizeName(host);
  while (name !== '') {
    const response = await safeQuery(name, 'CAA');
    const records = answersOfType(response, RR.CAA)
      .map((a) => parseCaa(a.data))
      .filter((r): r is CaaRecord => r !== null);
    if (records.length > 0) {
      return evaluateCaa(records, name);
    }
    // The root and single labels (TLDs) never carry a CAA policy for a site.
    if (!name.includes('.')) {
      break;
    }
    name = name.slice(name.indexOf('.') + 1);
  }
  return { found: false, foundOn: null, records: [], errors: [] };
}
